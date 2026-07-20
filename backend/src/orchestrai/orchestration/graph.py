"""Graph assembly: nodes, edges, checkpointing, and human approval gates.

Shape after M7 (the self-healing loop)::

    START → analyze → spec_gate → plan → plan_gate → select_task ──► END
                         │reject     │reject            │ task ready   (executed)
                         ▼           ▼                  ▼
                        END         END               code → verify
                                              pass ◄────┤
                                        (next task)     │ fail
                                                        ▼
                                             can_retry? debug → verify (again)
                                             out of retries → escalation_gate
                                                        │ (interrupt: skip/abort)
                                                        ▼
                                              skip → select_task / abort → END

Nodes are closures over their dependencies (llm, sandbox, events), created
by ``build_graph`` — plain constructor injection.
"""

from collections.abc import Awaitable, Callable
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from orchestrai.agents import analyst, coder, debugger, planner, reviewer
from orchestrai.application.event_bus import EventBus
from orchestrai.application.ports.llm import LLMProvider
from orchestrai.application.ports.sandbox import Sandbox
from orchestrai.application.services.verification import VerificationService
from orchestrai.domain.events import TaskEscalated, TaskFailed, TaskVerified
from orchestrai.domain.models.task import TaskStatus
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


async def _spec_gate(state: GraphState) -> StateUpdate:
    """Pause and ask the human to approve the requirement spec."""
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


def _route_after_spec_gate(state: GraphState) -> str:
    return "plan" if state.status == "planning" else END


def _make_plan(llm: LLMProvider) -> NodeFn:
    async def plan(state: GraphState) -> StateUpdate:
        assert state.spec is not None
        if state.budget.is_exhausted:  # analyst already crossed the limit
            return {"status": "halted"}
        result = await planner.plan(state.spec, llm)
        return {
            "plan": result.plan,
            "status": "awaiting_plan_approval",
            "budget": state.budget.record_spend(result.usage.cost_usd),
            "total_cost_usd": state.total_cost_usd + result.usage.cost_usd,
        }

    return plan


def _route_after_plan(state: GraphState) -> str:
    return END if state.status == "halted" else "plan_gate"


async def _plan_gate(state: GraphState) -> StateUpdate:
    """Pause before execution: coding is where the real money goes."""
    assert state.plan is not None
    answer = interrupt(
        {
            "question": "Approve this task plan and start building?",
            "tasks": [
                {"id": t.id, "description": t.description, "depends_on": list(t.depends_on)}
                for t in state.plan.tasks
            ],
        }
    )
    approved = bool(answer.get("approved", False)) if isinstance(answer, dict) else bool(answer)
    return {"status": "executing" if approved else "rejected"}


def _route_after_plan_gate(state: GraphState) -> str:
    return "select_task" if state.status == "executing" else END


async def _select_task(state: GraphState) -> StateUpdate:
    """Ask the domain which task is ready; mark it in_progress.

    This is also the budget checkpoint: each loop iteration spends money
    (coder + possible debugger calls), so an exhausted budget halts the run
    here — before the next spend, never mid-task.
    """
    assert state.plan is not None
    if state.budget.is_exhausted:
        return {"current_task_id": None, "status": "halted"}
    task = state.plan.next_ready_task()
    if task is None:
        return {"current_task_id": None, "status": "executed"}
    started = task.start()
    return {
        "current_task_id": task.id,
        "plan": state.plan.with_updated_task(started),
    }


def _route_after_select(state: GraphState) -> str:
    if state.status == "halted":
        return END
    return "code" if state.current_task_id is not None else "review"


def _make_review(llm: LLMProvider, sandbox: Sandbox) -> NodeFn:
    async def review(state: GraphState) -> StateUpdate:
        assert state.spec is not None
        # Deduplicated, ordered list of everything the run produced.
        paths = list(dict.fromkeys(a.path for a in state.artifacts))
        if not paths:  # every task escalated/skipped — nothing to review
            return {"status": "reviewed"}
        result = await reviewer.review(state.spec, paths, llm, sandbox)
        return {
            "review": result.report,
            "status": "reviewed",
            "budget": state.budget.record_spend(result.usage.cost_usd),
            "total_cost_usd": state.total_cost_usd + result.usage.cost_usd,
        }

    return review


def _make_code(llm: LLMProvider, sandbox: Sandbox) -> NodeFn:
    async def code(state: GraphState) -> StateUpdate:
        assert state.plan is not None and state.spec is not None
        assert state.current_task_id is not None
        task = next(t for t in state.plan.tasks if t.id == state.current_task_id)

        # Context: contents of files produced by the tasks this one depends on.
        dep_artifacts = {
            a.path: sandbox.read_file(a.path)
            for a in state.artifacts
            if a.task_id in task.depends_on
        }
        result = await coder.code(state.spec, task, dep_artifacts, llm, sandbox)
        return {
            "artifacts": state.artifacts + result.artifacts,
            "budget": state.budget.record_spend(result.usage.cost_usd),
            "total_cost_usd": state.total_cost_usd + result.usage.cost_usd,
        }

    return code


def _make_verify(sandbox: Sandbox, events: EventBus) -> NodeFn:
    async def verify(state: GraphState) -> StateUpdate:
        assert state.plan is not None and state.current_task_id is not None
        task = next(t for t in state.plan.tasks if t.id == state.current_task_id)

        result = await VerificationService(sandbox).verify()
        if result.passed:
            events.emit(TaskVerified(task_id=task.id, attempts=task.attempts))
            return {
                "plan": state.plan.with_updated_task(task.mark_verified()),
                "last_verification": None,
            }

        summary = result.failures[0].summary if result.failures else ""
        events.emit(TaskFailed(task_id=task.id, attempt=task.attempts, summary=summary[-300:]))
        return {
            "plan": state.plan.with_updated_task(task.mark_failed()),
            "last_verification": result,
        }

    return verify


def _route_after_verify(state: GraphState) -> str:
    assert state.plan is not None and state.current_task_id is not None
    task = next(t for t in state.plan.tasks if t.id == state.current_task_id)
    if task.status is TaskStatus.VERIFIED:
        return "select_task"
    # No money means no debug retries — a human decides, exactly as when
    # attempts run out.
    if task.can_retry and not state.budget.is_exhausted:
        return "debug"
    return "escalation_gate"


def _make_debug(llm: LLMProvider, sandbox: Sandbox) -> NodeFn:
    async def debug(state: GraphState) -> StateUpdate:
        assert state.plan is not None and state.current_task_id is not None
        assert state.last_verification is not None
        task = next(t for t in state.plan.tasks if t.id == state.current_task_id)

        task_files = {
            a.path: sandbox.read_file(a.path) for a in state.artifacts if a.task_id == task.id
        }
        result = await debugger.debug(task, state.last_verification, task_files, llm, sandbox)
        return {
            # retry() consumes one attempt and puts the task back in_progress;
            # the loop re-verifies the patched code next.
            "plan": state.plan.with_updated_task(task.retry()),
            "artifacts": state.artifacts + result.artifacts,
            "budget": state.budget.record_spend(result.usage.cost_usd),
            "total_cost_usd": state.total_cost_usd + result.usage.cost_usd,
        }

    return debug


def _make_escalation_gate(events: EventBus) -> NodeFn:
    async def escalation_gate(state: GraphState) -> StateUpdate:
        """Out of retries: hand the task to the human."""
        assert state.plan is not None and state.current_task_id is not None
        task = next(t for t in state.plan.tasks if t.id == state.current_task_id)
        events.emit(TaskEscalated(task_id=task.id))
        failure = state.last_verification
        answer = interrupt(
            {
                "question": (
                    f"Task {task.id!r} failed verification "
                    f"{task.attempts} times. Skip it and continue, or abort the run?"
                ),
                "task": {"id": task.id, "description": task.description},
                "failure": failure.model_dump() if failure else None,
            }
        )
        skip = bool(answer.get("skip", False)) if isinstance(answer, dict) else bool(answer)
        update: StateUpdate = {"plan": state.plan.with_updated_task(task.escalate())}
        if not skip:
            update["status"] = "aborted"
        return update

    return escalation_gate


def _route_after_escalation(state: GraphState) -> str:
    return END if state.status == "aborted" else "select_task"


def build_graph(
    llm: LLMProvider,
    sandbox: Sandbox,
    checkpointer: BaseCheckpointSaver[Any] | None = None,
    events: EventBus | None = None,
) -> Any:
    """Wire the full slice into a runnable graph."""
    bus = events or EventBus()
    graph = StateGraph(GraphState)
    # type-ignores: langgraph's node overloads want parameter-name-level
    # matches a Callable alias can't express; runtime is covered by
    # tests/integration/test_graph.py.
    graph.add_node("analyze", _make_analyze(llm), input_schema=GraphState)  # type: ignore[call-overload]
    graph.add_node("spec_gate", _spec_gate, input_schema=GraphState)
    graph.add_node("plan", _make_plan(llm), input_schema=GraphState)  # type: ignore[arg-type]
    graph.add_node("plan_gate", _plan_gate, input_schema=GraphState)
    graph.add_node("select_task", _select_task, input_schema=GraphState)
    graph.add_node("code", _make_code(llm, sandbox), input_schema=GraphState)  # type: ignore[arg-type]
    graph.add_node("verify", _make_verify(sandbox, bus), input_schema=GraphState)  # type: ignore[arg-type]
    graph.add_node("debug", _make_debug(llm, sandbox), input_schema=GraphState)  # type: ignore[arg-type]
    graph.add_node("escalation_gate", _make_escalation_gate(bus), input_schema=GraphState)  # type: ignore[arg-type]
    graph.add_node("review", _make_review(llm, sandbox), input_schema=GraphState)  # type: ignore[arg-type]

    graph.add_edge(START, "analyze")
    graph.add_edge("analyze", "spec_gate")
    graph.add_conditional_edges("spec_gate", _route_after_spec_gate, ["plan", END])
    graph.add_conditional_edges("plan", _route_after_plan, ["plan_gate", END])
    graph.add_conditional_edges("plan_gate", _route_after_plan_gate, ["select_task", END])
    graph.add_conditional_edges("select_task", _route_after_select, ["code", "review", END])
    graph.add_edge("code", "verify")
    graph.add_conditional_edges(
        "verify", _route_after_verify, ["select_task", "debug", "escalation_gate"]
    )
    graph.add_edge("debug", "verify")
    graph.add_conditional_edges("escalation_gate", _route_after_escalation, ["select_task", END])
    graph.add_edge("review", END)

    return graph.compile(checkpointer=checkpointer)
