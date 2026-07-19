"""Plan: an ordered collection of tasks forming a dependency DAG.

A plan is validated at construction:
  * every ``depends_on`` id must reference a task that exists in the plan;
  * the dependency graph must be acyclic (no deadlocks).

Both rules are enforced in a model validator, so an invalid Plan object can
never exist — callers downstream may trust any Plan they hold.
"""

from pydantic import BaseModel, model_validator

from orchestrai.domain.errors import InvalidPlanError
from orchestrai.domain.models.task import Task, TaskStatus


class Plan(BaseModel):
    """An immutable, validated task DAG for a single run."""

    model_config = {"frozen": True}

    tasks: tuple[Task, ...]

    @model_validator(mode="after")
    def _validate_dag(self) -> "Plan":
        ids = [t.id for t in self.tasks]
        id_set = set(ids)

        if len(ids) != len(id_set):
            raise InvalidPlanError("duplicate task ids in plan")

        # Rule 1: no dependency may point at a task that isn't in the plan.
        for task in self.tasks:
            missing = [dep for dep in task.depends_on if dep not in id_set]
            if missing:
                raise InvalidPlanError(f"task {task.id!r} depends on unknown task(s): {missing}")

        # Rule 2: the graph must be acyclic (DFS with a recursion stack).
        self._assert_acyclic()
        return self

    def _assert_acyclic(self) -> None:
        by_id = {t.id: t for t in self.tasks}
        UNVISITED, VISITING, DONE = 0, 1, 2
        state = dict.fromkeys(by_id, UNVISITED)

        def walk(task_id: str) -> None:
            state[task_id] = VISITING
            for dep in by_id[task_id].depends_on:
                if state[dep] == VISITING:
                    raise InvalidPlanError(f"dependency cycle detected involving task {dep!r}")
                if state[dep] == UNVISITED:
                    walk(dep)
            state[task_id] = DONE

        for task_id in by_id:
            if state[task_id] == UNVISITED:
                walk(task_id)

    def next_ready_task(self) -> Task | None:
        """Return the first pending task whose dependencies are all verified.

        This is how the orchestration layer (M6) picks what to build next.
        Returns None when nothing is currently runnable — either everything is
        done, or the remaining work is blocked/in flight.
        """
        verified = {t.id for t in self.tasks if t.status is TaskStatus.VERIFIED}
        for task in self.tasks:
            if task.status is TaskStatus.PENDING and all(
                dep in verified for dep in task.depends_on
            ):
                return task
        return None

    def is_complete(self) -> bool:
        """True when every task has reached a terminal state."""
        return all(t.is_terminal for t in self.tasks)

    def with_updated_task(self, updated: Task) -> "Plan":
        """Return a new Plan with one task replaced (matched by id).

        Raises:
            InvalidPlanError: if no task with that id exists.
        """
        if all(t.id != updated.id for t in self.tasks):
            raise InvalidPlanError(f"cannot update unknown task {updated.id!r}")
        return self.model_copy(
            update={"tasks": tuple(updated if t.id == updated.id else t for t in self.tasks)}
        )
