"""Tests for the VerificationService pipeline (real sandbox, real python)."""

from pathlib import Path

import pytest

from orchestrai.application.services.verification import VerificationService
from orchestrai.infrastructure.sandbox.local import LocalProcessSandbox


@pytest.fixture()
def sandbox(tmp_path: Path) -> LocalProcessSandbox:
    return LocalProcessSandbox(tmp_path / "ws")


async def test_clean_workspace_passes(sandbox: LocalProcessSandbox) -> None:
    sandbox.write_file("app.py", "x = 1\n")
    result = await VerificationService(sandbox).verify()
    assert result.passed
    assert result.failures == ()


async def test_syntax_error_fails_the_syntax_check(sandbox: LocalProcessSandbox) -> None:
    sandbox.write_file("bad.py", "def broken(:\n")
    result = await VerificationService(sandbox).verify()
    assert not result.passed
    assert result.failures[0].check == "syntax"
    assert "bad.py" in result.failures[0].summary


async def test_failing_test_fails_the_tests_check(sandbox: LocalProcessSandbox) -> None:
    sandbox.write_file("calc.py", "def add(a, b):\n    return a - b  # bug\n")
    sandbox.write_file(
        "test_calc.py",
        "from calc import add\n\ndef test_add():\n    assert add(2, 3) == 5\n",
    )
    result = await VerificationService(sandbox).verify()
    assert not result.passed
    assert result.failures[0].check == "tests"
    assert "test_add" in result.failures[0].summary


async def test_passing_tests_pass(sandbox: LocalProcessSandbox) -> None:
    sandbox.write_file("calc.py", "def add(a, b):\n    return a + b\n")
    sandbox.write_file(
        "test_calc.py",
        "from calc import add\n\ndef test_add():\n    assert add(2, 3) == 5\n",
    )
    result = await VerificationService(sandbox).verify()
    assert result.passed


async def test_syntax_failure_stops_before_tests(sandbox: LocalProcessSandbox) -> None:
    # Broken syntax AND a test that would fail: only the syntax failure reports.
    sandbox.write_file("bad.py", "def broken(:\n")
    sandbox.write_file("test_x.py", "def test_x():\n    assert False\n")
    result = await VerificationService(sandbox).verify()
    assert not result.passed
    assert len(result.failures) == 1
    assert result.failures[0].check == "syntax"
