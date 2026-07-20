"""Integration tests for the HTTP API: full runs driven over HTTP.

Real FastAPI app, real RunManager with background tasks, real sandbox in a
tmp dir — only the LLM is faked (injected via the manager's llm_factory
seam). httpx.ASGITransport keeps everything in one event loop.
"""

import asyncio
from pathlib import Path
from typing import Any

import httpx

from orchestrai.config import Settings
from orchestrai.infrastructure.llm.fake import FakeLLM
from orchestrai.interfaces.api.app import create_app
from orchestrai.interfaces.api.run_manager import RunManager

SPEC_JSON: dict[str, Any] = {
    "summary": "A Todo REST API",
    "functional_requirements": ["CRUD todos"],
    "constraints": [],
    "tech_stack": ["fastapi"],
    "ambiguities": [],
}
PLAN_JSON: dict[str, Any] = {
    "tasks": [{"id": "t1", "description": "implement calculator", "depends_on": []}]
}
CODE_JSON: dict[str, Any] = {
    "files": [{"path": "calc.py", "content": "def add(a, b):\n    return a + b\n"}]
}
REVIEW_JSON: dict[str, Any] = {
    "verdict": "approve",
    "findings": [],
    "readme_markdown": "# Generated\n",
}


def make_client(tmp_path: Path, fake: FakeLLM) -> httpx.AsyncClient:
    manager = RunManager(
        Settings(_env_file=None),
        data_dir=tmp_path,
        llm_factory=lambda settings, events: fake,
    )
    app = create_app(manager)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def wait_for_phase(
    client: httpx.AsyncClient, run_id: str, phase: str, timeout_s: float = 15.0
) -> dict[str, Any]:
    """Poll GET /runs/{id} until the background task reaches `phase`."""
    async with asyncio.timeout(timeout_s):
        while True:
            body = (await client.get(f"/runs/{run_id}")).json()
            if body["phase"] == phase:
                return body
            if body["phase"] == "failed":
                raise AssertionError(f"run failed: {body['error']}")
            await asyncio.sleep(0.05)


async def test_full_run_over_http(tmp_path: Path) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, CODE_JSON, REVIEW_JSON])
    async with make_client(tmp_path, fake) as client:
        # start → 202 with run id, immediately
        response = await client.post("/runs", json={"prompt": "Build a Todo API"})
        assert response.status_code == 202
        run_id = response.json()["run_id"]

        # spec gate
        body = await wait_for_phase(client, run_id, "waiting_for_approval")
        assert "Approve this requirement spec?" in body["interrupt"]["question"]
        response = await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        assert response.status_code == 200

        # plan gate
        body = await wait_for_phase(client, run_id, "waiting_for_approval")
        assert "task plan" in body["interrupt"]["question"]
        await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})

        # completion
        body = await wait_for_phase(client, run_id, "finished")
        assert body["status"] == "reviewed"
        assert body["review_verdict"] == "approve"
        assert "calc.py" in body["artifacts"]
        assert (tmp_path / "workspaces" / run_id / "README.md").exists()


async def test_reject_at_spec_gate_over_http(tmp_path: Path) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON])
    async with make_client(tmp_path, fake) as client:
        run_id = (await client.post("/runs", json={"prompt": "x"})).json()["run_id"]
        await wait_for_phase(client, run_id, "waiting_for_approval")
        await client.post(f"/runs/{run_id}/approvals", json={"decision": "reject"})

        body = await wait_for_phase(client, run_id, "finished")
        assert body["status"] == "rejected"
        assert len(fake.calls) == 1  # planner never ran


async def test_unknown_run_returns_404(tmp_path: Path) -> None:
    async with make_client(tmp_path, FakeLLM()) as client:
        assert (await client.get("/runs/nope")).status_code == 404
        response = await client.post("/runs/nope/approvals", json={"decision": "approve"})
        assert response.status_code == 404


async def test_approving_a_non_waiting_run_conflicts(tmp_path: Path) -> None:
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, CODE_JSON, REVIEW_JSON])
    async with make_client(tmp_path, fake) as client:
        run_id = (await client.post("/runs", json={"prompt": "x"})).json()["run_id"]
        await wait_for_phase(client, run_id, "waiting_for_approval")
        await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        await wait_for_phase(client, run_id, "waiting_for_approval")
        await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        await wait_for_phase(client, run_id, "finished")

        # finished run: no gate pending → 409
        response = await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        assert response.status_code == 409


async def test_llm_failure_surfaces_as_failed_phase(tmp_path: Path) -> None:
    from orchestrai.application.ports.llm import LLMError

    fake = FakeLLM([LLMError("provider down")])
    async with make_client(tmp_path, fake) as client:
        run_id = (await client.post("/runs", json={"prompt": "x"})).json()["run_id"]
        async with asyncio.timeout(15):
            while True:
                body = (await client.get(f"/runs/{run_id}")).json()
                if body["phase"] == "failed":
                    break
                await asyncio.sleep(0.05)
        assert "provider down" in body["error"]


async def test_event_subscription_receives_run_events(tmp_path: Path) -> None:
    # The WebSocket endpoint reads from manager.subscribe(); testing the
    # subscription layer directly avoids needing a live socket server.
    # FakeLLM emits no LLM events, but the sandbox emits FileWritten during
    # coding — so drive a full run and assert those arrive, history included.
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, CODE_JSON, REVIEW_JSON])
    manager = RunManager(Settings(_env_file=None), data_dir=tmp_path, llm_factory=lambda s, e: fake)
    app = create_app(manager)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        run_id = (await client.post("/runs", json={"prompt": "x"})).json()["run_id"]
        queue = manager.subscribe(run_id)  # subscribed BEFORE any file exists

        await wait_for_phase(client, run_id, "waiting_for_approval")
        await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        await wait_for_phase(client, run_id, "waiting_for_approval")
        await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        await wait_for_phase(client, run_id, "finished")

        names = []
        while not queue.empty():
            names.append(type(queue.get_nowait()).__name__)
        assert "FileWritten" in names  # coder wrote calc.py
        assert "TaskVerified" in names  # verify passed and announced it

        # A late subscriber still gets the full story (history replay).
        late = manager.subscribe(run_id)
        late_names = []
        while not late.empty():
            late_names.append(type(late.get_nowait()).__name__)
        assert late_names == names


async def test_generated_files_are_readable_over_http(tmp_path: Path) -> None:
    """The frontend's Code tab depends on GET /runs/{id}/files/{path}."""
    fake = FakeLLM([SPEC_JSON, PLAN_JSON, CODE_JSON, REVIEW_JSON])
    async with make_client(tmp_path, fake) as client:
        run_id = (await client.post("/runs", json={"prompt": "x"})).json()["run_id"]
        await wait_for_phase(client, run_id, "waiting_for_approval")
        await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        await wait_for_phase(client, run_id, "waiting_for_approval")
        await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        body = await wait_for_phase(client, run_id, "finished")
        assert "calc.py" in body["artifacts"]

        # the artifact announced over the API is fetchable, content intact
        response = await client.get(f"/runs/{run_id}/files/calc.py")
        assert response.status_code == 200
        assert response.json() == {
            "path": "calc.py",
            "content": "def add(a, b):\n    return a + b\n",
        }

        # unknown files and path escapes are refused, run untouched
        assert (await client.get(f"/runs/{run_id}/files/nope.py")).status_code == 404
        assert (await client.get(f"/runs/{run_id}/files/../secrets.txt")).status_code == 404
        assert (await client.get("/runs/nope/files/calc.py")).status_code == 404


class _SlowFakeLLM(FakeLLM):
    """FakeLLM that hangs forever — a run stuck mid-LLM-call, cancellable."""

    def __init__(self) -> None:
        super().__init__([])
        self.started = asyncio.Event()

    async def complete(self, messages, *, output_schema):  # type: ignore[override]
        self.started.set()
        await asyncio.sleep(3600)  # cancelled long before this elapses
        raise AssertionError("unreachable")


async def test_cancel_terminates_a_running_execution(tmp_path: Path) -> None:
    """DELETE /runs/{id} must stop the background task, not just the UI."""
    fake = _SlowFakeLLM()
    manager = RunManager(Settings(_env_file=None), data_dir=tmp_path, llm_factory=lambda s, e: fake)
    app = create_app(manager)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        run_id = (await client.post("/runs", json={"prompt": "x"})).json()["run_id"]
        await asyncio.wait_for(fake.started.wait(), timeout=10)  # mid-LLM-call

        response = await client.delete(f"/runs/{run_id}")
        assert response.status_code == 200
        assert response.json()["phase"] == "cancelled"

        # the background asyncio task actually died — no orphan work
        task = manager._task_by_run[run_id]
        async with asyncio.timeout(5):
            while not task.done():
                await asyncio.sleep(0.02)
        assert task.cancelled() or task.done()

        # phase sticks; cancelling again is a harmless no-op
        assert (await client.get(f"/runs/{run_id}")).json()["phase"] == "cancelled"
        assert (await client.delete(f"/runs/{run_id}")).json()["phase"] == "cancelled"
        # unknown runs still 404
        assert (await client.delete("/runs/nope")).status_code == 404


async def test_cancel_while_waiting_at_gate(tmp_path: Path) -> None:
    """Cancelling at an approval gate flips the phase and blocks approval."""
    fake = FakeLLM([SPEC_JSON, PLAN_JSON])
    async with make_client(tmp_path, fake) as client:
        run_id = (await client.post("/runs", json={"prompt": "x"})).json()["run_id"]
        await wait_for_phase(client, run_id, "waiting_for_approval")

        assert (await client.delete(f"/runs/{run_id}")).json()["phase"] == "cancelled"
        # the gate is gone: approving a cancelled run conflicts
        response = await client.post(f"/runs/{run_id}/approvals", json={"decision": "approve"})
        assert response.status_code == 409
        assert len(fake.calls) == 1  # planner never ran
