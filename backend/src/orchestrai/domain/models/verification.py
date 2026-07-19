"""VerificationResult: the business interpretation of "does the code work?"

Raw ExecutionResults (exit codes, stdout) come from the sandbox; this model
is what they *mean*: which check failed and why. It is what the Debugger
reads to repair code, and what a human sees on escalation.
"""

from pydantic import BaseModel, model_validator


class CheckFailure(BaseModel):
    """One failed verification check."""

    model_config = {"frozen": True}

    check: str  # "syntax" | "dependencies" | "tests"
    summary: str  # tail of the tool output — enough for a debugger to act on


class VerificationResult(BaseModel):
    """Outcome of verifying the workspace after a task."""

    model_config = {"frozen": True}

    passed: bool
    failures: tuple[CheckFailure, ...] = ()

    @model_validator(mode="after")
    def _consistent(self) -> "VerificationResult":
        if self.passed == bool(self.failures):
            raise ValueError("passed=True requires no failures, passed=False requires some")
        return self
