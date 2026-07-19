"""GraphState: the bag of data that travels through the graph.

Every node receives the current state and returns a partial update (only the
keys it changed); LangGraph merges updates into the state and checkpoints the
result after each node. Everything here must round-trip through JSON — which
our frozen Pydantic domain models were built for.
"""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from orchestrai.agents.reviewer import ReviewReport
from orchestrai.domain.models.artifact import Artifact
from orchestrai.domain.models.budget import Budget
from orchestrai.domain.models.plan import Plan
from orchestrai.domain.models.requirement_spec import RequirementSpec
from orchestrai.domain.models.verification import VerificationResult

#: Where a run can end up.
RunStatus = Literal[
    "analyzing",
    "awaiting_approval",
    "planning",
    "awaiting_plan_approval",
    "executing",
    "executed",
    "reviewed",
    "rejected",
    "aborted",
    "halted",  # budget exhausted — the run stopped spending
]


class GraphState(BaseModel):
    """State for the analyze → approve → plan → approve → execute slice.

    NOT frozen: LangGraph replaces field values as nodes return updates.
    The *values* (Budget, Plan, spec) stay immutable domain objects — only
    which object a field points at changes.
    """

    prompt: str = Field(min_length=1)
    budget: Budget
    status: RunStatus = "analyzing"
    spec: RequirementSpec | None = None
    plan: Plan | None = None
    current_task_id: str | None = None
    artifacts: tuple[Artifact, ...] = ()
    last_verification: VerificationResult | None = None
    review: ReviewReport | None = None
    total_cost_usd: Decimal = Decimal("0")
