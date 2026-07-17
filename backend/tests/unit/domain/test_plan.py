"""Unit tests for the Plan domain model: DAG validation and scheduling."""

import pytest

from orchestrai.domain.errors import InvalidPlanError
from orchestrai.domain.models.plan import Plan
from orchestrai.domain.models.task import Task, TaskStatus


def task(id: str, depends_on: tuple[str, ...] = (), status: str = "pending") -> Task:
    return Task(
        id=id,
        description=f"do {id}",
        depends_on=depends_on,
        status=TaskStatus(status),
    )


class TestValidation:
    def test_simple_linear_plan_is_valid(self) -> None:
        plan = Plan(tasks=(task("t1"), task("t2", ("t1",)), task("t3", ("t2",))))
        assert len(plan.tasks) == 3

    def test_dangling_dependency_is_rejected(self) -> None:
        with pytest.raises(InvalidPlanError, match="unknown task"):
            Plan(tasks=(task("t1", ("t99",)),))

    def test_duplicate_ids_rejected(self) -> None:
        with pytest.raises(InvalidPlanError, match="duplicate"):
            Plan(tasks=(task("t1"), task("t1")))

    def test_direct_cycle_is_rejected(self) -> None:
        with pytest.raises(InvalidPlanError, match="cycle"):
            Plan(tasks=(task("t1", ("t2",)), task("t2", ("t1",))))

    def test_indirect_cycle_is_rejected(self) -> None:
        # t1 -> t2 -> t3 -> t1
        with pytest.raises(InvalidPlanError, match="cycle"):
            Plan(
                tasks=(
                    task("t1", ("t3",)),
                    task("t2", ("t1",)),
                    task("t3", ("t2",)),
                )
            )

    def test_self_dependency_is_a_cycle(self) -> None:
        with pytest.raises(InvalidPlanError, match="cycle"):
            Plan(tasks=(task("t1", ("t1",)),))

    def test_diamond_shape_is_valid(self) -> None:
        # t1 splits to t2 and t3, both rejoin at t4 — a DAG, not a cycle.
        plan = Plan(
            tasks=(
                task("t1"),
                task("t2", ("t1",)),
                task("t3", ("t1",)),
                task("t4", ("t2", "t3")),
            )
        )
        assert len(plan.tasks) == 4


class TestScheduling:
    def test_first_ready_task_has_no_deps(self) -> None:
        plan = Plan(tasks=(task("t1"), task("t2", ("t1",))))
        ready = plan.next_ready_task()
        assert ready is not None and ready.id == "t1"

    def test_dependent_task_blocked_until_dep_verified(self) -> None:
        plan = Plan(tasks=(task("t1", status="verified"), task("t2", ("t1",))))
        ready = plan.next_ready_task()
        assert ready is not None and ready.id == "t2"

    def test_no_ready_task_when_dep_unverified(self) -> None:
        # t1 in progress (not verified) -> t2 not runnable, t1 not pending
        plan = Plan(tasks=(task("t1", status="in_progress"), task("t2", ("t1",))))
        assert plan.next_ready_task() is None

    def test_is_complete_when_all_terminal(self) -> None:
        plan = Plan(tasks=(task("t1", status="verified"), task("t2", status="escalated")))
        assert plan.is_complete()

    def test_not_complete_with_pending_task(self) -> None:
        plan = Plan(tasks=(task("t1", status="verified"), task("t2")))
        assert not plan.is_complete()
