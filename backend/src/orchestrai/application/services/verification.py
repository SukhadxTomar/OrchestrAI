"""Verification service: run checks against the workspace and interpret them.

Three checks, cheapest first (fail fast — don't run tests on code that
doesn't even parse):
  1. syntax     — python -m compileall (catches SyntaxError in any file)
  2. dependencies — pip install -r requirements.txt into the run's venv
                    (skipped when the project has no requirements.txt)
  3. tests      — pytest, if any test files exist

This is a service, not an agent: no judgment, no LLM — just commands and
interpretation. The judgment (how to FIX a failure) belongs to the Debugger.
"""

import sys

from orchestrai.application.ports.sandbox import ExecutionResult, Sandbox
from orchestrai.domain.models.verification import CheckFailure, VerificationResult

_TAIL_CHARS = 4000  # enough context for a debugger without blowing the prompt


def _tail(result: ExecutionResult) -> str:
    text = (result.stdout + "\n" + result.stderr).strip()
    if result.timed_out:
        text = f"[TIMED OUT after {result.duration_ms}ms]\n{text}"
    return text[-_TAIL_CHARS:]


class VerificationService:
    """Runs the check pipeline inside a sandbox."""

    def __init__(self, sandbox: Sandbox) -> None:
        self._sandbox = sandbox

    async def verify(self) -> VerificationResult:
        """Run all checks; stop at the first failing one."""
        syntax = await self._sandbox.run(
            [sys.executable, "-m", "compileall", "-q", "."], timeout_s=60
        )
        if not syntax.ok:
            return _failed("syntax", syntax)

        if (self._sandbox.root / "requirements.txt").exists():
            deps = await self._sandbox.run(
                [sys.executable, "-m", "pip", "install", "-q", "-r", "requirements.txt"],
                timeout_s=300,
            )
            if not deps.ok:
                return _failed("dependencies", deps)

        if any(self._sandbox.root.rglob("test_*.py")):
            tests = await self._sandbox.run(
                [sys.executable, "-m", "pytest", "-q", "--no-header"], timeout_s=300
            )
            if not tests.ok:
                return _failed("tests", tests)

        return VerificationResult(passed=True)


def _failed(check: str, result: ExecutionResult) -> VerificationResult:
    return VerificationResult(
        passed=False, failures=(CheckFailure(check=check, summary=_tail(result)),)
    )
