"""Tests for LocalProcessSandbox: file jail, command execution, timeouts.

The attack tests are the important ones: they prove escape attempts fail.
"""

import sys
from pathlib import Path

import pytest

from orchestrai.application.event_bus import EventBus
from orchestrai.application.ports.sandbox import Sandbox, SandboxViolation
from orchestrai.domain.events import CommandExecuted, DomainEvent, FileWritten
from orchestrai.infrastructure.sandbox.local import LocalProcessSandbox


class RecordingSink:
    def __init__(self) -> None:
        self.events: list[DomainEvent] = []

    def handle(self, event: DomainEvent) -> None:
        self.events.append(event)


@pytest.fixture()
def sandbox(tmp_path: Path) -> LocalProcessSandbox:
    return LocalProcessSandbox(tmp_path / "ws")


def test_satisfies_the_port_protocol(sandbox: LocalProcessSandbox) -> None:
    port: Sandbox = sandbox
    assert port.root.name == "ws"


class TestFileJail:
    def test_write_and_read_roundtrip(self, sandbox: LocalProcessSandbox) -> None:
        sandbox.write_file("src/app/main.py", "print('hi')\n")
        assert sandbox.read_file("src/app/main.py") == "print('hi')\n"

    def test_parents_are_auto_created(self, sandbox: LocalProcessSandbox) -> None:
        target = sandbox.write_file("deep/nested/dir/file.txt", "x")
        assert target.exists()

    # ── attack tests ────────────────────────────────────────────────────

    def test_dotdot_traversal_blocked(self, sandbox: LocalProcessSandbox) -> None:
        with pytest.raises(SandboxViolation, match="outside the workspace"):
            sandbox.write_file("../escape.txt", "pwned")

    def test_deep_dotdot_traversal_blocked(self, sandbox: LocalProcessSandbox) -> None:
        with pytest.raises(SandboxViolation):
            sandbox.write_file("a/b/../../../../escape.txt", "pwned")

    def test_absolute_path_blocked(self, sandbox: LocalProcessSandbox, tmp_path: Path) -> None:
        outside = tmp_path / "outside.txt"
        with pytest.raises(SandboxViolation):
            sandbox.write_file(str(outside), "pwned")

    def test_read_outside_blocked(self, sandbox: LocalProcessSandbox) -> None:
        with pytest.raises(SandboxViolation):
            sandbox.read_file("../../etc/passwd")

    def test_sneaky_dotdot_inside_stays_allowed(self, sandbox: LocalProcessSandbox) -> None:
        # a/b/../c resolves to a/c — still inside. Jail must not over-block.
        sandbox.write_file("a/b/../c.txt", "fine")
        assert sandbox.read_file("a/c.txt") == "fine"


class TestCommandExecution:
    async def test_captures_stdout_and_exit_code(self, sandbox: LocalProcessSandbox) -> None:
        result = await sandbox.run([sys.executable, "-c", "print('hello')"])
        assert result.ok
        assert result.exit_code == 0
        assert "hello" in result.stdout

    async def test_captures_stderr_and_failure(self, sandbox: LocalProcessSandbox) -> None:
        result = await sandbox.run([sys.executable, "-c", "import sys; sys.exit(3)"])
        assert not result.ok
        assert result.exit_code == 3

    async def test_runs_with_workspace_as_cwd(self, sandbox: LocalProcessSandbox) -> None:
        sandbox.write_file("marker.txt", "here")
        result = await sandbox.run(
            [sys.executable, "-c", "from pathlib import Path; print(Path('marker.txt').exists())"]
        )
        assert "True" in result.stdout

    async def test_timeout_kills_hung_process(self, sandbox: LocalProcessSandbox) -> None:
        result = await sandbox.run(
            [sys.executable, "-c", "import time; time.sleep(60)"], timeout_s=0.5
        )
        assert result.timed_out
        assert not result.ok
        assert result.duration_ms < 10_000  # killed quickly, not after 60s


class TestEvents:
    async def test_actions_are_announced(self, tmp_path: Path) -> None:
        sink = RecordingSink()
        sandbox = LocalProcessSandbox(tmp_path / "ws", events=EventBus([sink]))
        sandbox.write_file("f.txt", "data")
        await sandbox.run([sys.executable, "-c", "pass"])

        kinds = [type(e) for e in sink.events]
        assert kinds == [FileWritten, CommandExecuted]
        write_event = sink.events[0]
        assert isinstance(write_event, FileWritten)
        assert write_event.path == "f.txt"
        assert write_event.size_bytes == 4
