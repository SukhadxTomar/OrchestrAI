"""Task: the atomic unit of work in a run, with an enforced lifecycle.

A task moves through a fixed state machine::

    pending ──start()──► in_progress ──mark_verified()──► verified
                 ▲            │
                 │       mark_failed()
                 │            ▼
              retry()◄──── failed ────escalate()──► escalated

Illegal jumps (e.g. pending → verified) raise InvalidTaskTransitionError.
Retries are bounded: once ``attempts`` reaches ``max_attempts``, the only
legal move from ``failed`` is ``escalate()``.
"""

from enum import StrEnum

from pydantic import BaseModel, Field

from orchestrai.domain.errors import InvalidTaskTransitionError


class TaskStatus(StrEnum):
    """Every state a task can be in. StrEnum so it serializes as plain text."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    VERIFIED = "verified"
    FAILED = "failed"
    ESCALATED = "escalated"


#: The single source of truth for legal lifecycle jumps.
_ALLOWED_TRANSITIONS: dict[TaskStatus, frozenset[TaskStatus]] = {
    TaskStatus.PENDING: frozenset({TaskStatus.IN_PROGRESS}),
    TaskStatus.IN_PROGRESS: frozenset({TaskStatus.VERIFIED, TaskStatus.FAILED}),
    TaskStatus.FAILED: frozenset({TaskStatus.IN_PROGRESS, TaskStatus.ESCALATED}),
    TaskStatus.VERIFIED: frozenset(),  # terminal
    TaskStatus.ESCALATED: frozenset(),  # terminal (until a human intervenes)
}


class Task(BaseModel):
    """One unit of work (e.g. "implement JWT auth") with lifecycle rules.

    Immutable: every transition returns a new ``Task``, same as ``Budget``.
    """

    model_config = {"frozen": True}

    id: str = Field(min_length=1)
    description: str = Field(min_length=1)
    depends_on: tuple[str, ...] = ()
    status: TaskStatus = TaskStatus.PENDING
    attempts: int = Field(default=0, ge=0)
    max_attempts: int = Field(default=3, gt=0)

    @property
    def is_terminal(self) -> bool:
        """True when no further transitions are possible."""
        return not _ALLOWED_TRANSITIONS[self.status]

    @property
    def can_retry(self) -> bool:
        """True while a failed task still has attempts left."""
        return self.status is TaskStatus.FAILED and self.attempts < self.max_attempts

    def start(self) -> "Task":
        """pending → in_progress; counts as the first attempt."""
        return self._transition(TaskStatus.IN_PROGRESS, bump_attempts=True)

    def mark_verified(self) -> "Task":
        """in_progress → verified (verification passed)."""
        return self._transition(TaskStatus.VERIFIED)

    def mark_failed(self) -> "Task":
        """in_progress → failed (verification failed)."""
        return self._transition(TaskStatus.FAILED)

    def retry(self) -> "Task":
        """failed → in_progress, consuming one attempt. Refused when spent."""
        if not self.can_retry:
            raise InvalidTaskTransitionError(
                f"task {self.id!r}: no retries left "
                f"({self.attempts}/{self.max_attempts} attempts used) — escalate instead"
            )
        return self._transition(TaskStatus.IN_PROGRESS, bump_attempts=True)

    def escalate(self) -> "Task":
        """failed → escalated: hand the task to a human."""
        return self._transition(TaskStatus.ESCALATED)

    def _transition(self, to: TaskStatus, *, bump_attempts: bool = False) -> "Task":
        """Single enforcement point for the state machine."""
        if to not in _ALLOWED_TRANSITIONS[self.status]:
            raise InvalidTaskTransitionError(
                f"task {self.id!r}: illegal transition {self.status.value!r} -> {to.value!r}"
            )
        update: dict[str, object] = {"status": to}
        if bump_attempts:
            update["attempts"] = self.attempts + 1
        return self.model_copy(update=update)
