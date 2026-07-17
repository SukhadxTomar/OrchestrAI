"""Budget: the business rule that bounds what a run may spend.

Rule: an exhausted budget must halt the run. The orchestration layer will
*enforce* the halt (M4+); the *decision* of whether we are exhausted lives
here, in the domain.
"""

from decimal import Decimal

from pydantic import BaseModel, Field

from orchestrai.domain.errors import BudgetExceededError


class Budget(BaseModel):
    """Immutable spending tracker for a single run.

    Spending never mutates a ``Budget`` — ``record_spend`` returns a *new*
    instance. This keeps historical states valid (checkpoints, debugging)
    and makes the model safe to share.
    """

    model_config = {"frozen": True}

    limit_usd: Decimal = Field(gt=0)
    spent_usd: Decimal = Field(default=Decimal("0"), ge=0)

    @property
    def remaining_usd(self) -> Decimal:
        """What is left to spend. Never negative — overspend clamps to zero."""
        return max(self.limit_usd - self.spent_usd, Decimal("0"))

    @property
    def is_exhausted(self) -> bool:
        """True once spending has reached or passed the limit."""
        return self.spent_usd >= self.limit_usd

    def record_spend(self, amount_usd: Decimal) -> "Budget":
        """Return a new Budget with ``amount_usd`` added to the total spent.

        Raises:
            BudgetExceededError: if the budget is already exhausted. A single
                call may *cross* the limit (LLM costs are only known after the
                call completes) — but nothing further may be spent after that.
            ValueError: if ``amount_usd`` is negative.
        """
        if amount_usd < 0:
            raise ValueError(f"spend amount must be >= 0, got {amount_usd}")
        if self.is_exhausted:
            raise BudgetExceededError(
                f"budget exhausted: spent {self.spent_usd} of {self.limit_usd} USD"
            )
        return self.model_copy(update={"spent_usd": self.spent_usd + amount_usd})
