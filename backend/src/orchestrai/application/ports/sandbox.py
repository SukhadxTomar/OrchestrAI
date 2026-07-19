"""Sandbox port: the only hands the system has.

All file I/O and command execution for generated projects goes through this
contract. Implementations MUST jail every operation to a single workspace
directory — a path that resolves outside it is a SandboxViolation, and a
command that exceeds its timeout is killed, not awaited.

Least privilege: three operations. Anything the platform cannot do through
them, it cannot do at all.
"""

from pathlib import Path
from typing import Protocol

from pydantic import BaseModel, Field


class ExecutionResult(BaseModel):
    """Outcome of one command run inside the sandbox.

    This is the raw material the verification service (M7) parses to decide
    pass/fail — so it captures everything a debugger would want to see.
    """

    model_config = {"frozen": True}

    command: tuple[str, ...]
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int = Field(ge=0)
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and not self.timed_out


class SandboxViolation(Exception):
    """An operation tried to escape the workspace jail.

    Not a DomainError: this is a safety boundary breach, and it must never
    be silently handled — the run should stop loudly.
    """


class Sandbox(Protocol):
    """Workspace-jailed file I/O and command execution."""

    @property
    def root(self) -> Path:
        """Absolute path of the workspace this sandbox is jailed to."""
        ...

    def write_file(self, relative_path: str, content: str) -> Path:
        """Write ``content`` inside the workspace; parents auto-created.

        Raises:
            SandboxViolation: if the resolved path escapes the workspace.
        """
        ...

    def read_file(self, relative_path: str) -> str:
        """Read a file from inside the workspace.

        Raises:
            SandboxViolation: if the resolved path escapes the workspace.
            FileNotFoundError: if it doesn't exist.
        """
        ...

    async def run(self, command: list[str], *, timeout_s: float = 60.0) -> ExecutionResult:
        """Run a command with the workspace as cwd; kill it on timeout."""
        ...
