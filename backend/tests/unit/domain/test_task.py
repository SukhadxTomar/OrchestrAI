"""Unit tests for the Task domain model and its state machine."""

import pytest

from orchestrai.domain.errors import InvalidTaskTransitionError
from orchestrai.domain.models.task import Task, TaskStatus


def make_task(**overrides: object) -> Task:
    defaults: dict[str, object] = {"id": "t1", "description": "implement JWT auth"}
    return Task(**{**defaults, **overrides})  # type: ignore[arg-type]


class TestHappyPath:
    def test_full_lifecycle_to_verified(self) -> None:
        task = make_task().start().mark_verified()
        assert task.status is TaskStatus.VERIFIED
        assert task.attempts == 1
        assert task.is_terminal

    def test_start_counts_as_first_attempt(self) -> None:
        assert make_task().start().attempts == 1


class TestIllegalTransitions:
    def test_pending_cannot_jump_to_verified(self) -> None:
        with pytest.raises(InvalidTaskTransitionError, match="pending' -> 'verified"):
            make_task().mark_verified()

    def test_verified_is_terminal(self) -> None:
        done = make_task().start().mark_verified()
        with pytest.raises(InvalidTaskTransitionError):
            done.mark_failed()

    def test_escalated_is_terminal(self) -> None:
        stuck = make_task(max_attempts=1).start().mark_failed().escalate()
        with pytest.raises(InvalidTaskTransitionError):
            stuck.retry()

    def test_pending_cannot_escalate(self) -> None:
        with pytest.raises(InvalidTaskTransitionError):
            make_task().escalate()


class TestRetryPolicy:
    def test_failed_task_can_retry_within_budget(self) -> None:
        task = make_task().start().mark_failed()
        assert task.can_retry
        retried = task.retry()
        assert retried.status is TaskStatus.IN_PROGRESS
        assert retried.attempts == 2

    def test_retries_are_bounded(self) -> None:
        task = make_task(max_attempts=2).start().mark_failed()  # attempt 1 used
        task = task.retry().mark_failed()  # attempt 2 used
        assert not task.can_retry
        with pytest.raises(InvalidTaskTransitionError, match="no retries left"):
            task.retry()

    def test_exhausted_task_can_still_escalate(self) -> None:
        task = make_task(max_attempts=1).start().mark_failed()
        assert task.escalate().status is TaskStatus.ESCALATED


class TestImmutability:
    def test_transitions_return_new_instances(self) -> None:
        original = make_task()
        started = original.start()
        assert original.status is TaskStatus.PENDING
        assert started.status is TaskStatus.IN_PROGRESS


class TestSerialization:
    def test_status_serializes_as_plain_string(self) -> None:
        # Matters for checkpointing (M4): state must round-trip through JSON.
        dumped = make_task().model_dump()
        assert dumped["status"] == "pending"
        restored = Task.model_validate(dumped)
        assert restored == make_task()
