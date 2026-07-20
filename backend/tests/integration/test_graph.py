"""Integration tests: the full M6 graph on FakeLLM + a real sandbox.

analyze → spec_gate → plan → plan_gate → select_task ⇄ code → executed

Real LangGraph, real checkpointing, real (tmp_path) sandbox — only the LLM
is faked. No network, no cost.
"""

from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from orchestrai.domain.models.budget import Budget
from orchestrai.domain.models.task import TaskStatus
from orchestrai.infrastructure.llm.fake import FakeLLM
from orchestrai.infrastructure.sandbox.local import LocalProcessSandbox
from orchestrai.orchestration.graph import build_graph
from orchestrai.orchestration.state import GraphState

SPEC_JSON: dict[str, Any] = {
    "summary": "A Todo REST API",
    "functional_requirements": ["CRUD todos", "JWT auth"],
    "constraints": ["FastAPI"],
    "tech_stack": ["fastapi", "pytest"],
    "ambiguities": [],
}

PLAN_JSON: dict[str, Any] = {
    "tasks": [
        {"id": "t1", "description": "scaffold FastAPI app", "depends_on": []},
        {"id": "t2", "description": "todo CRUD endpoints", "depends_on": ["t1"]},
    ]
}

REVIEW_JSON: dict[str, Any] = {
    "verdict": "approve",
    "findings": [],
    "readme_markdown": "# Generated Project\n\nBuilt by OrchestrAI.\n",
}

T1_CODE: dict[str, Any] = {"files": [{"path": "app/main.py", "content": "app = 'scaffold'\n"}]}
T2_CODE: dict[str, Any] = {
    "files": [
        {"path": "app/routes.py", "content": "routes = ['/todos']\n"},
        {"path": "app/main.py", "content": "app = 'scaffold+routes'\n"},
    ]
}


@pytest.fixture()
def sandbox(tmp_path: Path) -> LocalProcessSandbox:
    return LocalProcessSandbox(tmp_path / "ws")


def initial_state(prompt: str = "Build a Todo API") -> dict[str, Any]:
    return GraphState(prompt=prompt, budget=Budget(limit_usd=Decimal("5.00"))).model_dump()


def config(thread: str) -> dict[str, Any]:
    return {"configurable": {"thread_id": thread}}


APPROVE = Command(resume={"approved": True})
REJECT = Command(resume={"approved": False})


async def run_to_completion(fake: FakeLLM, sandbox: LocalProcessSandbox, thread: str) -> GraphState:
    """Drive a full happy-path run: start, approve spec, approve plan."""
    graph = build_graph(fake, sandbox, checkpointer=MemorySaver())
    cfg = config(thread)
    await graph.ainvoke(initial_state(), cfg)  # pauses at spec gate
    await graph.ainvoke(APPROVE, cfg)  # pauses at plan gate
    result = await graph.ainvoke(APPROVE, cfg)  # runs the task loop to the end
    return GraphState.model_validate(result)


async def test_full_run_executes_all_tasks(sandbox: LocalProcessSandbox) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, T1_CODE, T2_CODE, REVIEW_JSON])
    state = await run_to_completion(fake, sandbox, "t-full")

    assert state.status == "reviewed"
    assert state.plan is not None
    assert all(t.status is TaskStatus.VERIFIED for t in state.plan.tasks)


async def test_files_actually_land_in_workspace(sandbox: LocalProcessSandbox) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, T1_CODE, T2_CODE, REVIEW_JSON])
    await run_to_completion(fake, sandbox, "t-files")

    # t2's version of main.py must have overwritten t1's.
    assert sandbox.read_file("app/main.py") == "app = 'scaffold+routes'\n"
    assert sandbox.read_file("app/routes.py") == "routes = ['/todos']\n"


async def test_artifacts_track_which_task_wrote_what(sandbox: LocalProcessSandbox) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, T1_CODE, T2_CODE, REVIEW_JSON])
    state = await run_to_completion(fake, sandbox, "t-artifacts")

    by_task = {(a.task_id, a.path) for a in state.artifacts}
    assert by_task == {
        ("t1", "app/main.py"),
        ("t2", "app/routes.py"),
        ("t2", "app/main.py"),
    }


async def test_dependency_context_flows_to_dependent_task(
    sandbox: LocalProcessSandbox,
) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, T1_CODE, T2_CODE, REVIEW_JSON])
    await run_to_completion(fake, sandbox, "t-context")

    # The coder call for t2 (4th LLM call) must include t1's file content.
    t2_prompt = fake.calls[3][-1].content
    assert "app/main.py" in t2_prompt
    assert "app = 'scaffold'" in t2_prompt


async def test_tasks_run_in_dependency_order(sandbox: LocalProcessSandbox) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, T1_CODE, T2_CODE, REVIEW_JSON])
    await run_to_completion(fake, sandbox, "t-order")

    # Call 3 is t1's coding prompt, call 4 is t2's — never the reverse,
    # because t2 depends on t1.
    assert "(t1)" in fake.calls[2][-1].content
    assert "(t2)" in fake.calls[3][-1].content


async def test_plan_rejection_stops_before_any_coding(
    sandbox: LocalProcessSandbox,
) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, T1_CODE, T2_CODE, REVIEW_JSON])
    graph = build_graph(fake, sandbox, checkpointer=MemorySaver())
    cfg = config("t-reject-plan")
    await graph.ainvoke(initial_state(), cfg)
    await graph.ainvoke(APPROVE, cfg)  # approve spec
    result = await graph.ainvoke(REJECT, cfg)  # reject plan

    state = GraphState.model_validate(result)
    assert state.status == "rejected"
    assert state.artifacts == ()
    assert len(fake.calls) == 2  # analyst + planner only — no coding spend


async def test_costs_accumulate_per_llm_call(sandbox: LocalProcessSandbox) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, T1_CODE, T2_CODE, REVIEW_JSON])
    state = await run_to_completion(fake, sandbox, "t-cost")

    # 5 calls x 0.001 (FakeLLM default usage)
    assert state.total_cost_usd == Decimal("0.005")
    assert state.budget.spent_usd == Decimal("0.005")


async def test_resume_across_graph_instances_mid_execution(
    sandbox: LocalProcessSandbox,
) -> None:
    # Kill-and-resume: a FRESH graph object continues the same thread.
    saver = MemorySaver()
    cfg = config("t-resume-exec")

    graph1 = build_graph(FakeLLM([SPEC_JSON, PLAN_JSON]), sandbox, checkpointer=saver)
    await graph1.ainvoke(initial_state(), cfg)
    await graph1.ainvoke(APPROVE, cfg)  # now paused at plan gate

    graph2 = build_graph(FakeLLM([T1_CODE, T2_CODE, REVIEW_JSON]), sandbox, checkpointer=saver)
    result = await graph2.ainvoke(APPROVE, cfg)

    state = GraphState.model_validate(result)
    assert state.status == "reviewed"
    assert sandbox.read_file("app/routes.py") == "routes = ['/todos']\n"


# ── M7: self-healing loop ────────────────────────────────────────────────

GOOD_CODE: dict[str, Any] = {
    "files": [{"path": "calc.py", "content": "def add(a, b):\n    return a + b\n"}]
}
BUGGY_CODE: dict[str, Any] = {
    "files": [
        {"path": "calc.py", "content": "def add(a, b):\n    return a - b\n"},
        {
            "path": "test_calc.py",
            "content": "from calc import add\n\ndef test_add():\n    assert add(2, 3) == 5\n",
        },
    ]
}
FIX_PATCH: dict[str, Any] = {
    "hypothesis": "add() subtracts instead of adding",
    "files": [{"path": "calc.py", "content": "def add(a, b):\n    return a + b\n"}],
}
BAD_PATCH: dict[str, Any] = {
    "hypothesis": "maybe the assert is wrong",
    "files": [{"path": "calc.py", "content": "def add(a, b):\n    return a * b\n"}],
}

ONE_TASK_PLAN: dict[str, Any] = {
    "tasks": [{"id": "t1", "description": "implement calculator", "depends_on": []}]
}


async def test_selfheal_buggy_code_gets_debugged_then_passes(
    sandbox: LocalProcessSandbox,
) -> None:
    # code(buggy) → verify FAIL → debug(fix) → verify PASS → executed
    fake = FakeLLM([SPEC_JSON, ONE_TASK_PLAN, BUGGY_CODE, FIX_PATCH, REVIEW_JSON])
    state = await run_to_completion(fake, sandbox, "t-selfheal")

    assert state.status == "reviewed"
    assert state.plan is not None
    task = state.plan.tasks[0]
    assert task.status is TaskStatus.VERIFIED
    assert task.attempts == 2  # initial + one debug retry
    assert sandbox.read_file("calc.py") == "def add(a, b):\n    return a + b\n"


async def test_selfheal_debugger_sees_the_failure_and_the_files(
    sandbox: LocalProcessSandbox,
) -> None:
    fake = FakeLLM([SPEC_JSON, ONE_TASK_PLAN, BUGGY_CODE, FIX_PATCH, REVIEW_JSON])
    await run_to_completion(fake, sandbox, "t-debug-ctx")

    debug_prompt = fake.calls[3][-1].content
    assert "test_add" in debug_prompt  # pytest failure output
    assert "return a - b" in debug_prompt  # current (buggy) file content


async def test_good_code_verifies_first_try_no_debugger(
    sandbox: LocalProcessSandbox,
) -> None:
    fake = FakeLLM([SPEC_JSON, ONE_TASK_PLAN, GOOD_CODE, REVIEW_JSON])
    state = await run_to_completion(fake, sandbox, "t-firsttry")

    assert state.status == "reviewed"
    assert len(fake.calls) == 4  # analyst, planner, coder, reviewer — no debugger
    assert state.plan is not None and state.plan.tasks[0].attempts == 1


async def test_escalation_after_retries_exhausted_then_skip(
    sandbox: LocalProcessSandbox,
) -> None:
    # 3 attempts (initial + 2 bad patches) → escalation interrupt → skip → END
    fake = FakeLLM([SPEC_JSON, ONE_TASK_PLAN, BUGGY_CODE, BAD_PATCH, BAD_PATCH, REVIEW_JSON])
    graph = build_graph(fake, sandbox, checkpointer=MemorySaver())
    cfg = config("t-escalate")
    await graph.ainvoke(initial_state(), cfg)
    await graph.ainvoke(APPROVE, cfg)  # spec
    result = await graph.ainvoke(APPROVE, cfg)  # plan → runs into escalation

    assert "__interrupt__" in result
    payload = result["__interrupt__"][0].value
    assert "failed verification 3 times" in payload["question"]
    assert payload["failure"] is not None

    final = await graph.ainvoke(Command(resume={"skip": True}), cfg)
    state = GraphState.model_validate(final)
    assert state.status == "reviewed"  # run finished despite the bad task
    assert state.plan is not None
    assert state.plan.tasks[0].status is TaskStatus.ESCALATED


async def test_escalation_abort_ends_the_run(sandbox: LocalProcessSandbox) -> None:
    fake = FakeLLM([SPEC_JSON, ONE_TASK_PLAN, BUGGY_CODE, BAD_PATCH, BAD_PATCH])
    graph = build_graph(fake, sandbox, checkpointer=MemorySaver())
    cfg = config("t-abort")
    await graph.ainvoke(initial_state(), cfg)
    await graph.ainvoke(APPROVE, cfg)
    await graph.ainvoke(APPROVE, cfg)

    final = await graph.ainvoke(Command(resume={"skip": False}), cfg)
    state = GraphState.model_validate(final)
    assert state.status == "aborted"


# ── M8: review + README generation ──────────────────────────────────────


async def test_review_runs_after_all_tasks_and_writes_readme(
    sandbox: LocalProcessSandbox,
) -> None:
    fake = FakeLLM([SPEC_JSON, ONE_TASK_PLAN, GOOD_CODE, REVIEW_JSON])
    state = await run_to_completion(fake, sandbox, "t-review")

    assert state.status == "reviewed"
    assert state.review is not None and state.review.verdict == "approve"
    assert "Generated Project" in sandbox.read_file("README.md")
    # Reviewer saw the generated file's content.
    review_prompt = fake.calls[3][-1].content
    assert "calc.py" in review_prompt


async def test_exhausted_budget_halts_before_next_task(
    sandbox: LocalProcessSandbox,
) -> None:
    # Tiny budget: analyst (0.001) + planner (0.001) exhaust a 0.002 limit,
    # so the loop must halt before ANY coding spend.
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, T1_CODE, T2_CODE, REVIEW_JSON])
    graph = build_graph(fake, sandbox, checkpointer=MemorySaver())
    cfg = config("t-budget-halt")
    state_dict = GraphState(
        prompt="Build a Todo API", budget=Budget(limit_usd=Decimal("0.002"))
    ).model_dump()
    await graph.ainvoke(state_dict, cfg)
    await graph.ainvoke(APPROVE, cfg)  # spec
    result = await graph.ainvoke(APPROVE, cfg)  # plan → select_task → halt

    state = GraphState.model_validate(result)
    assert state.status == "halted"
    assert state.artifacts == ()  # not a single file written
    assert len(fake.calls) == 2  # analyst + planner only
    assert state.budget.is_exhausted


async def test_generous_budget_never_halts(sandbox: LocalProcessSandbox) -> None:
    fake = FakeLLM([SPEC_JSON, ONE_TASK_PLAN, GOOD_CODE, REVIEW_JSON])
    state = await run_to_completion(fake, sandbox, "t-budget-ok")
    assert state.status == "reviewed"
    assert not state.budget.is_exhausted
