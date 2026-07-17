"""Domain errors: business rule violations, distinct from programming errors.

Catching ``DomainError`` means "a business rule said no" — as opposed to a
bug (``TypeError``) or an infrastructure failure (network, disk).
"""


class DomainError(Exception):
    """Base class for all business rule violations."""


class BudgetExceededError(DomainError):
    """Raised when spending is attempted on an exhausted budget."""


class InvalidTaskTransitionError(DomainError):
    """Raised when a task is asked to make a lifecycle jump its rules forbid."""


class InvalidPlanError(DomainError):
    """Raised when a plan is structurally invalid (dangling deps or a cycle)."""
