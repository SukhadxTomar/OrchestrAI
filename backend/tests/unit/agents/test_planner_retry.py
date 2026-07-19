"""Unit tests for planner invalid-plan retry (LLM draft vs domain validator)."""

from decimal import Decimal
from typing import Any

import pytest

from orchestrai.agents.planner import plan
from orchestrai.domain.errors import InvalidPlanError
from orchestrai.domain.models.requirement_spec import RequirementSpec
from orchestrai.infrastructure.llm.fake import FakeLLM

SPEC = RequirementSpec(summary="A Todo API", functional_requirements=("CRUD",))

CYCLIC: dict[str, Any] = {
    "tasks": [
        {"id": "t1", "description": "a", "depends_on": ["t2"]},
        {"id": "t2", "description": "b", "depends_on": ["t1"]},
    ]
}
VALID: dict[str, Any] = {
    "tasks": [
        {"id": "t1", "description": "a", "depends_on": []},
        {"id": "t2", "description": "b", "depends_on": ["t1"]},
    ]
}


async def test_invalid_draft_is_fed_back_and_corrected() -> None:
    fake = FakeLLM([CYCLIC, VALID])
    result = await plan(SPEC, fake)

    assert [t.id for t in result.plan.tasks] == ["t1", "t2"]
    # The retry message must explain the violation to the model.
    retry_prompt = fake.calls[1][-1].content
    assert "structurally invalid" in retry_prompt
    assert "cycle" in retry_prompt
    # Cost covers BOTH attempts.
    assert result.usage.cost_usd == Decimal("0.002")


async def test_gives_up_after_retry_budget() -> None:
    fake = FakeLLM([CYCLIC, CYCLIC])
    with pytest.raises(InvalidPlanError, match="cycle"):
        await plan(SPEC, fake, max_retries=1)


async def test_valid_first_draft_needs_no_retry() -> None:
    fake = FakeLLM([VALID])
    result = await plan(SPEC, fake)
    assert len(fake.calls) == 1
    assert result.usage.cost_usd == Decimal("0.001")
