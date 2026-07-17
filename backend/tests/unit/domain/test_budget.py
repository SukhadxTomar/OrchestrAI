"""Unit tests for the Budget domain model."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from orchestrai.domain.errors import BudgetExceededError
from orchestrai.domain.models.budget import Budget


def make_budget(limit: str = "5.00", spent: str = "0") -> Budget:
    return Budget(limit_usd=Decimal(limit), spent_usd=Decimal(spent))


class TestConstruction:
    def test_fresh_budget_has_nothing_spent(self) -> None:
        budget = make_budget("5.00")
        assert budget.spent_usd == Decimal("0")
        assert budget.remaining_usd == Decimal("5.00")
        assert not budget.is_exhausted

    def test_zero_or_negative_limit_is_unrepresentable(self) -> None:
        with pytest.raises(ValidationError):
            Budget(limit_usd=Decimal("0"))
        with pytest.raises(ValidationError):
            Budget(limit_usd=Decimal("-1"))

    def test_negative_spent_is_unrepresentable(self) -> None:
        with pytest.raises(ValidationError):
            make_budget("5.00", "-0.01")


class TestImmutability:
    def test_budget_is_frozen(self) -> None:
        budget = make_budget()
        with pytest.raises(ValidationError):
            budget.spent_usd = Decimal("99")  # type: ignore[misc]

    def test_record_spend_returns_new_instance(self) -> None:
        original = make_budget("5.00")
        updated = original.record_spend(Decimal("1.25"))
        assert original.spent_usd == Decimal("0")  # original untouched
        assert updated.spent_usd == Decimal("1.25")


class TestSpending:
    def test_spending_accumulates(self) -> None:
        budget = make_budget("5.00").record_spend(Decimal("2.00")).record_spend(Decimal("1.50"))
        assert budget.spent_usd == Decimal("3.50")
        assert budget.remaining_usd == Decimal("1.50")

    def test_decimal_arithmetic_is_exact(self) -> None:
        # The reason we use Decimal, not float: 0.1 + 0.2 style drift.
        budget = make_budget("1.00")
        for _ in range(10):
            budget = budget.record_spend(Decimal("0.1"))
        assert budget.spent_usd == Decimal("1.0")
        assert budget.is_exhausted

    def test_negative_spend_rejected(self) -> None:
        with pytest.raises(ValueError, match="must be >= 0"):
            make_budget().record_spend(Decimal("-1"))


class TestExhaustion:
    def test_single_call_may_cross_the_limit(self) -> None:
        # LLM cost is only known after the call — crossing is allowed once.
        budget = make_budget("5.00", "4.90").record_spend(Decimal("0.50"))
        assert budget.spent_usd == Decimal("5.40")
        assert budget.is_exhausted
        assert budget.remaining_usd == Decimal("0")  # clamped, never negative

    def test_spending_on_exhausted_budget_raises(self) -> None:
        budget = make_budget("5.00", "5.00")
        with pytest.raises(BudgetExceededError, match="exhausted"):
            budget.record_spend(Decimal("0.01"))

    def test_exactly_at_limit_is_exhausted(self) -> None:
        assert make_budget("5.00", "5.00").is_exhausted
