"""GraphState: the bag of data that travels through the graph.

Every node receives the current state and returns a partial update (only the
keys it changed); LangGraph merges updates into the state and checkpoints the
result after each node. Everything here must round-trip through JSON — which
our frozen Pydantic domain models were built for.
"""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from orchestrai.domain.models.budget import Budget
from orchestrai.domain.models.plan import Plan
from orchestrai.domain.models.requirement_spec import RequirementSpec

#: Where a run can end up. Grows as the graph grows (M6+: executing, done...).
RunStatus = Literal["analyzing", "awaiting_approval", "planning", "planned", "rejected"]


class GraphState(BaseModel):
    """State for the analyze → approve → plan slice.

    NOT frozen: LangGraph replaces field values as nodes return updates.
    The *values* (Budget, Plan, spec) stay immutable domain objects — only
    which object a field points at changes.
    """

    prompt: str = Field(min_length=1)
    budget: Budget
    status: RunStatus = "analyzing"
    spec: RequirementSpec | None = None
    plan: Plan | None = None
    total_cost_usd: Decimal = Decimal("0")
