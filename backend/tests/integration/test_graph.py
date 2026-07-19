"""Integration tests: the full analyze → approve → plan graph on FakeLLM.

These exercise the real LangGraph engine — real checkpointing, real
interrupts — with only the LLM faked. No network, no cost.
"""

from decimal import Decimal
from typing import Any

import pytest
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from orchestrai.domain.models.budget import Budget
from orchestrai.domain.models.task import TaskStatus
from orchestrai.infrastructure.llm.fake import FakeLLM
from orchestrai.orchestration.graph import build_graph
from orchestrai.orchestration.state import GraphState

SPEC_JSON: dict[str, Any] = {
    "summary": "A Todo REST API",
    "functional_requirements": ["CRUD todos", "JWT auth"],
    "constraints": ["FastAPI"],
    "tech_stack": ["fastapi", "pytest"],
    "ambiguities": [
        {
            "kind": "resolved",
            "question": "Which database?",
            "chosen_default": "SQLite",
            "rationale": "simplest for a starter API",
        }
    ],
}

PLAN_JSON: dict[str, Any] = {
    "tasks": [
        {"id": "t1", "description": "scaffold FastAPI project", "depends_on": []},
        {"id": "t2", "description": "todo CRUD endpoints", "depends_on": ["t1"]},
        {"id": "t3", "description": "JWT auth", "depends_on": ["t1"]},
    ]
}


def initial_state(prompt: str = "Build a Todo API") -> dict[str, Any]:
    return GraphState(prompt=prompt, budget=Budget(limit_usd=Decimal("5.00"))).model_dump()


def config(thread: str) -> dict[str, Any]:
    return {"configurable": {"thread_id": thread}}


async def test_graph_pauses_at_approval_with_spec_ready() -> None:
    graph = build_graph(FakeLLM([SPEC_JSON]), checkpointer=MemorySaver())
    result = await graph.ainvoke(initial_state(), config("t-pause"))

    assert "__interrupt__" in result  # graph is waiting for a human
    state = GraphState.model_validate(result)
    assert state.status == "awaiting_approval"
    assert state.spec is not None and state.spec.summary == "A Todo REST API"
    assert state.plan is None  # planner must NOT have run yet


async def test_approve_resumes_and_produces_validated_plan() -> None:
    graph = build_graph(FakeLLM([SPEC_JSON, PLAN_JSON]), checkpointer=MemorySaver())
    cfg = config("t-approve")
    await graph.ainvoke(initial_state(), cfg)
    result = await graph.ainvoke(Command(resume={"approved": True}), cfg)

    state = GraphState.model_validate(result)
    assert state.status == "planned"
    assert state.plan is not None
    assert [t.id for t in state.plan.tasks] == ["t1", "t2", "t3"]
    assert all(t.status is TaskStatus.PENDING for t in state.plan.tasks)


async def test_reject_ends_run_without_planning() -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON])
    graph = build_graph(fake, checkpointer=MemorySaver())
    cfg = config("t-reject")
    await graph.ainvoke(initial_state(), cfg)
    result = await graph.ainvoke(Command(resume={"approved": False}), cfg)

    state = GraphState.model_validate(result)
    assert state.status == "rejected"
    assert state.plan is None
    assert len(fake.calls) == 1  # planner never called — no wasted money


async def test_costs_accumulate_across_nodes_in_budget() -> None:
    graph = build_graph(FakeLLM([SPEC_JSON, PLAN_JSON]), checkpointer=MemorySaver())
    cfg = config("t-cost")
    await graph.ainvoke(initial_state(), cfg)
    result = await graph.ainvoke(Command(resume={"approved": True}), cfg)

    state = GraphState.model_validate(result)
    # FakeLLM charges 0.001 per call; two agent calls ran.
    assert state.total_cost_usd == Decimal("0.002")
    assert state.budget.spent_usd == Decimal("0.002")


async def test_state_survives_checkpoint_round_trip() -> None:
    # Same thread, two separate invocations against one saver — resume proves
    # the state (spec included) was rebuilt from the checkpoint, not memory.
    saver = MemorySaver()
    cfg = config("t-roundtrip")

    graph1 = build_graph(FakeLLM([SPEC_JSON]), checkpointer=saver)
    await graph1.ainvoke(initial_state(), cfg)

    graph2 = build_graph(FakeLLM([PLAN_JSON]), checkpointer=saver)  # fresh graph object
    result = await graph2.ainvoke(Command(resume={"approved": True}), cfg)

    state = GraphState.model_validate(result)
    assert state.status == "planned"
    assert state.spec is not None  # restored from checkpoint, not from RAM


async def test_llm_failure_surfaces_not_swallowed() -> None:
    from orchestrai.application.ports.llm import LLMError

    graph = build_graph(FakeLLM([LLMError("provider down")]), checkpointer=MemorySaver())
    with pytest.raises(LLMError, match="provider down"):
        await graph.ainvoke(initial_state(), config("t-fail"))
