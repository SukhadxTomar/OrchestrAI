"""Graph assembly: nodes, edges, checkpointing, and the human approval gate.

Shape of the first slice::

    START → analyze → approval_gate → plan → END
                          │ (interrupt: human answers approve/reject)
                          └── reject → END

Nodes are closures over their dependencies (llm provider), created by
``build_graph`` — plain constructor injection, same style as everywhere else.
"""

from collections.abc import Awaitable, Callable
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from orchestrai.agents import analyst, planner
from orchestrai.application.ports.llm import LLMProvider
from orchestrai.orchestration.state import GraphState

#: What every node returns: a partial state update for LangGraph to merge.
StateUpdate = dict[str, Any]
NodeFn = Callable[[GraphState], Awaitable[StateUpdate]]


def _make_analyze(llm: LLMProvider) -> NodeFn:
    async def analyze(state: GraphState) -> StateUpdate:
        response = await analyst.analyze(state.prompt, llm)
        return {
            "spec": response.parsed,
            "status": "awaiting_approval",
            "budget": state.budget.record_spend(response.usage.cost_usd),
            "total_cost_usd": state.total_cost_usd + response.usage.cost_usd,
        }

    return analyze


async def _approval_gate(state: GraphState) -> dict[str, Any]:
    """Pause the graph and ask the human to approve the spec.

    ``interrupt`` checkpoints the run and raises; on resume the same node
    re-executes and ``interrupt`` returns the human's answer instead.
    """
    assert state.spec is not None  # analyze always ran first
    answer = interrupt(
        {
            "question": "Approve this requirement spec?",
            "spec": state.spec.model_dump(),
            "open_questions": [a.question for a in state.spec.open_ambiguities()],
        }
    )
    approved = bool(answer.get("approved", False)) if isinstance(answer, dict) else bool(answer)
    return {"status": "planning" if approved else "rejected"}


def _route_after_approval(state: GraphState) -> str:
    return "plan" if state.status == "planning" else END


def _make_plan(llm: LLMProvider) -> NodeFn:
    async def plan(state: GraphState) -> dict[str, Any]:
        assert state.spec is not None
        result = await planner.plan(state.spec, llm)
        return {
            "plan": result.plan,
            "status": "planned",
            "budget": state.budget.record_spend(result.usage.cost_usd),
            "total_cost_usd": state.total_cost_usd + result.usage.cost_usd,
        }

    return plan


def build_graph(llm: LLMProvider, checkpointer: BaseCheckpointSaver[Any] | None = None) -> Any:
    """Wire the analyze → approve → plan slice into a runnable graph."""
    graph = StateGraph(GraphState)
    # type-ignores: langgraph's _Node protocol wants parameter-name-level
    # matches that a Callable alias can't express; runtime is covered by
    # the integration tests in tests/integration/test_graph.py.
    graph.add_node("analyze", _make_analyze(llm), input_schema=GraphState)  # type: ignore[call-overload]
    graph.add_node("approval_gate", _approval_gate, input_schema=GraphState)
    graph.add_node("plan", _make_plan(llm), input_schema=GraphState)  # type: ignore[arg-type]

    graph.add_edge(START, "analyze")
    graph.add_edge("analyze", "approval_gate")
    graph.add_conditional_edges("approval_gate", _route_after_approval, ["plan", END])
    graph.add_edge("plan", END)

    return graph.compile(checkpointer=checkpointer)
