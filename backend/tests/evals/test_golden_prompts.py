"""Golden-prompt evals: the whole platform against a REAL LLM.

These cost real money and are excluded from normal runs. Opt in explicitly:

    uv run pytest tests/evals -m eval

Each eval drives the full graph (auto-approving gates), then asserts on
OUTCOMES: the project exists, verification passed, budget respected. It
does not assert on exact file contents — LLM output varies; outcomes are
the stable contract.
"""

from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

from orchestrai.config import Settings
from orchestrai.domain.models.budget import Budget
from orchestrai.domain.models.task import TaskStatus
from orchestrai.infrastructure.llm.openrouter import OpenRouterProvider
from orchestrai.infrastructure.sandbox.local import LocalProcessSandbox
from orchestrai.orchestration.graph import build_graph
from orchestrai.orchestration.state import GraphState

pytestmark = pytest.mark.eval

GOLDEN_PROMPT = (
    "Build a small Todo REST API in FastAPI with in-memory storage: "
    "CRUD endpoints for todos, plus pytest unit tests for every endpoint."
)
BUDGET_USD = Decimal("1.00")


@pytest.fixture()
def settings() -> Settings:
    s = Settings()
    if not s.openrouter_api_key.get_secret_value():
        pytest.skip("ORCHESTRAI_OPENROUTER_API_KEY not set")
    return s


async def test_golden_todo_api(settings: Settings, tmp_path: Path) -> None:
    provider = OpenRouterProvider(
        api_key=settings.openrouter_api_key.get_secret_value(),
        model=settings.openrouter_model,
    )
    sandbox = LocalProcessSandbox(tmp_path / "ws")
    try:
        graph = build_graph(provider, sandbox, checkpointer=MemorySaver())
        cfg: dict[str, Any] = {"configurable": {"thread_id": "eval-todo"}}
        initial = GraphState(prompt=GOLDEN_PROMPT, budget=Budget(limit_usd=BUDGET_USD))

        result = await graph.ainvoke(initial.model_dump(), cfg)
        result = await graph.ainvoke(Command(resume={"approved": True}), cfg)
        result = await graph.ainvoke(Command(resume={"approved": True}), cfg)
        state = GraphState.model_validate(result)
    finally:
        await provider.aclose()

    # Outcome contract:
    assert state.status == "reviewed", f"run ended in {state.status}"
    assert state.plan is not None
    verified = [t for t in state.plan.tasks if t.status is TaskStatus.VERIFIED]
    assert verified, "no task reached verified"
    assert state.artifacts, "no files were produced"
    assert (sandbox.root / "README.md").exists()
    assert state.total_cost_usd <= BUDGET_USD

    print(  # eval report — visible with pytest -s
        f"\n[eval] tasks verified: {len(verified)}/{len(state.plan.tasks)}  "
        f"files: {len({a.path for a in state.artifacts})}  "
        f"cost: ${state.total_cost_usd}"
    )
