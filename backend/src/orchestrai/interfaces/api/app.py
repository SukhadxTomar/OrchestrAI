"""OrchestrAI HTTP API: the control plane any frontend talks to.

    uv run uvicorn orchestrai.interfaces.api.app:create_app --factory --reload

Endpoints (the contract frontend/README.md promised on day one):
    POST /runs                  start a run          → {run_id}
    GET  /runs/{id}             status + state snapshot
    POST /runs/{id}/approvals   answer a pending gate
    WS   /runs/{id}/events      live event stream
"""

from decimal import Decimal
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from orchestrai.config import Settings
from orchestrai.interfaces.api.run_manager import RunManager, RunPhase


class StartRunRequest(BaseModel):
    prompt: str = Field(min_length=1)
    budget_usd: float = Field(default=5.0, gt=0)


class ApprovalRequest(BaseModel):
    decision: Literal["approve", "reject", "skip", "abort"]


class RunSummary(BaseModel):
    run_id: str
    phase: RunPhase
    status: str | None = None
    interrupt: dict[str, Any] | None = None
    total_cost_usd: str | None = None
    artifacts: list[str] = []
    review_verdict: str | None = None
    error: str | None = None


def create_app(manager: RunManager | None = None) -> FastAPI:
    """App factory; a custom manager is injected by tests."""
    app = FastAPI(title="OrchestrAI", version="0.1.0")
    app.state.manager = manager or RunManager(Settings())

    def get_manager() -> RunManager:
        return app.state.manager  # type: ignore[no-any-return]

    Manager = Annotated[RunManager, Depends(get_manager)]

    def summarize(handle: Any) -> RunSummary:
        state = handle.state
        return RunSummary(
            run_id=handle.run_id,
            phase=handle.phase,
            status=state.status if state else None,
            interrupt=handle.interrupt_payload,
            total_cost_usd=str(state.total_cost_usd) if state else None,
            artifacts=sorted({a.path for a in state.artifacts}) if state else [],
            review_verdict=state.review.verdict if state and state.review else None,
            error=handle.error,
        )

    @app.post("/runs", status_code=202)
    async def start_run(request: StartRunRequest, manager: Manager) -> RunSummary:
        # async so it runs ON the event loop — RunManager spawns asyncio
        # tasks, which is impossible from FastAPI's sync-endpoint threadpool.
        handle = manager.start(request.prompt, Decimal(str(request.budget_usd)))
        return summarize(handle)

    @app.get("/runs/{run_id}")
    async def get_run(run_id: str, manager: Manager) -> RunSummary:
        handle = manager.get(run_id)
        if handle is None:
            raise HTTPException(404, f"unknown run id: {run_id}")
        return summarize(handle)

    @app.post("/runs/{run_id}/approvals")
    async def answer_gate(run_id: str, request: ApprovalRequest, manager: Manager) -> RunSummary:
        if manager.get(run_id) is None:
            raise HTTPException(404, f"unknown run id: {run_id}")
        handle = manager.approve(
            run_id,
            approved=request.decision == "approve",
            skip=request.decision == "skip",
        )
        if handle is None:
            raise HTTPException(409, "run is not waiting for approval")
        return summarize(handle)

    @app.websocket("/runs/{run_id}/events")
    async def stream_events(websocket: WebSocket, run_id: str) -> None:
        manager = get_manager()
        if manager.get(run_id) is None:
            await websocket.close(code=4004, reason="unknown run id")
            return
        await websocket.accept()
        queue = manager.subscribe(run_id)
        try:
            while True:
                event = await queue.get()
                await websocket.send_json(
                    {"event": type(event).__name__, "data": event.model_dump(mode="json")}
                )
        except WebSocketDisconnect:
            pass
        finally:
            manager.unsubscribe(run_id, queue)

    return app
