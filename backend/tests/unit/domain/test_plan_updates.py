"""Unit tests for Plan.with_updated_task (immutable task replacement)."""

import pytest

from orchestrai.domain.errors import InvalidPlanError
from orchestrai.domain.models.plan import Plan
from orchestrai.domain.models.task import Task, TaskStatus


def make_plan() -> Plan:
    return Plan(
        tasks=(
            Task(id="t1", description="scaffold"),
            Task(id="t2", description="routes", depends_on=("t1",)),
        )
    )


def test_replaces_matching_task_and_keeps_others() -> None:
    plan = make_plan()
    updated = plan.with_updated_task(plan.tasks[0].start())

    assert updated.tasks[0].status is TaskStatus.IN_PROGRESS
    assert updated.tasks[1].status is TaskStatus.PENDING
    assert plan.tasks[0].status is TaskStatus.PENDING  # original untouched


def test_unknown_task_id_rejected() -> None:
    with pytest.raises(InvalidPlanError, match="unknown task"):
        make_plan().with_updated_task(Task(id="t99", description="ghost"))


def test_updated_plan_is_revalidated() -> None:
    # with_updated_task goes through the model validator again — DAG rules hold.
    plan = make_plan().with_updated_task(make_plan().tasks[0].start())
    assert plan.next_ready_task() is None  # t1 in_progress, t2 blocked on it
