"""LocalProcessSandbox: subprocess-based sandbox jailed to one workspace.

Security model (v1, local trust level):
  * every path is resolved and must stay under the workspace root
    (blocks ``../`` traversal and absolute paths);
  * commands run with the workspace as cwd and are killed on timeout;
  * every action is announced on the event bus.

OS-level isolation (network, filesystem outside cwd for the *child process
itself*) is NOT provided here — that is the future DockerSandbox adapter,
same port. This adapter's jail governs what the ORCHESTRATOR can be asked
to do, and stops accidents and prompt-injection path tricks.
"""

import asyncio
import time
from pathlib import Path

from orchestrai.application.event_bus import EventBus
from orchestrai.application.ports.sandbox import ExecutionResult, SandboxViolation
from orchestrai.domain.events import CommandExecuted, FileWritten


class LocalProcessSandbox:
    """Sandbox implementation over the local filesystem and subprocesses."""

    def __init__(self, workspace: Path, *, events: EventBus | None = None) -> None:
        self._root = workspace.resolve()
        self._root.mkdir(parents=True, exist_ok=True)
        self._events = events or EventBus()

    @property
    def root(self) -> Path:
        return self._root

    def _jail(self, relative_path: str) -> Path:
        """Resolve a path and refuse anything that escapes the workspace."""
        candidate = (self._root / relative_path).resolve()
        if not candidate.is_relative_to(self._root):
            raise SandboxViolation(
                f"path {relative_path!r} resolves outside the workspace ({candidate})"
            )
        return candidate

    def write_file(self, relative_path: str, content: str) -> Path:
        target = self._jail(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        self._events.emit(
            FileWritten(
                path=str(target.relative_to(self._root)),
                size_bytes=len(content.encode("utf-8")),
            )
        )
        return target

    def read_file(self, relative_path: str) -> str:
        return self._jail(relative_path).read_text(encoding="utf-8")

    async def run(self, command: list[str], *, timeout_s: float = 60.0) -> ExecutionResult:
        started = time.monotonic()
        process = await asyncio.create_subprocess_exec(
            *command,
            cwd=self._root,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        timed_out = False
        try:
            stdout_b, stderr_b = await asyncio.wait_for(process.communicate(), timeout=timeout_s)
        except TimeoutError:
            timed_out = True
            process.kill()
            stdout_b, stderr_b = await process.communicate()

        result = ExecutionResult(
            command=tuple(command),
            exit_code=-1 if timed_out else (process.returncode or 0),
            stdout=stdout_b.decode("utf-8", errors="replace"),
            stderr=stderr_b.decode("utf-8", errors="replace"),
            duration_ms=int((time.monotonic() - started) * 1000),
            timed_out=timed_out,
        )
        self._events.emit(
            CommandExecuted(
                command=result.command,
                exit_code=result.exit_code,
                duration_ms=result.duration_ms,
                timed_out=result.timed_out,
            )
        )
        return result
