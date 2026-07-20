"""RunManager: owns background graph executions for the API.

The HTTP layer must return immediately, so each run executes as an asyncio
task. The manager tracks status, buffers events for WebSocket streaming,
and routes approval answers to paused runs. One manager per process.
"""

import asyncio
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command
from pydantic import BaseModel

from orchestrai.application.event_bus import EventBus
from orchestrai.config import Settings
from orchestrai.domain.events import DomainEvent
from orchestrai.domain.models.budget import Budget
from orchestrai.infrastructure.llm.openrouter import OpenRouterProvider
from orchestrai.infrastructure.sandbox.local import LocalProcessSandbox
from orchestrai.infrastructure.telemetry.sinks import JsonlTraceSink
from orchestrai.orchestration.graph import build_graph
from orchestrai.orchestration.state import GraphState

RunPhase = Literal["running", "waiting_for_approval", "finished", "failed"]


class RunHandle(BaseModel):
    """Everything the API needs to answer questions about one run."""

    model_config = {"arbitrary_types_allowed": True}

    run_id: str
    phase: RunPhase = "running"
    interrupt_payload: dict[str, Any] | None = None
    state: GraphState | None = None
    error: str | None = None


class _QueueSink:
    """EventSink fanning events into per-run asyncio queues (for WebSockets).

    Keeps the full event history so a subscriber that connects mid-run (or
    reconnects) receives everything from the beginning — no missed events,
    no race between run start and WebSocket attach.
    """

    def __init__(self) -> None:
        self.queues: list[asyncio.Queue[DomainEvent]] = []
        self.history: list[DomainEvent] = []

    def handle(self, event: DomainEvent) -> None:
        self.history.append(event)
        for queue in self.queues:
            queue.put_nowait(event)

    def attach(self) -> asyncio.Queue[DomainEvent]:
        queue: asyncio.Queue[DomainEvent] = asyncio.Queue()
        for event in self.history:  # replay the past first
            queue.put_nowait(event)
        self.queues.append(queue)
        return queue


class RunManager:
    """Starts, tracks, and resumes graph runs as background tasks."""

    def __init__(
        self,
        settings: Settings,
        *,
        data_dir: Path = Path("."),
        llm_factory: Any = None,  # test seam: (settings, events) -> LLMProvider
    ) -> None:
        self._settings = settings
        self._db_path = data_dir / "runs" / "checkpoints.sqlite"
        self._traces_dir = data_dir / "traces"
        self._workspaces_dir = data_dir / "workspaces"
        self._llm_factory = llm_factory or self._default_llm_factory
        self._runs: dict[str, RunHandle] = {}
        self._event_sinks: dict[str, _QueueSink] = {}
        self._tasks: set[asyncio.Task[None]] = set()

    @staticmethod
    def _default_llm_factory(settings: Settings, events: EventBus) -> Any:
        return OpenRouterProvider(
            api_key=settings.openrouter_api_key.get_secret_value(),
            model=settings.openrouter_model,
            events=events,
        )

    # ── public API ──────────────────────────────────────────────────────

    def start(self, prompt: str, budget_usd: Decimal) -> RunHandle:
        run_id = uuid.uuid4().hex[:8]
        handle = RunHandle(run_id=run_id)
        self._runs[run_id] = handle
        initial = GraphState(prompt=prompt, budget=Budget(limit_usd=budget_usd))
        self._launch(run_id, initial.model_dump())
        return handle

    def get(self, run_id: str) -> RunHandle | None:
        return self._runs.get(run_id)

    def approve(self, run_id: str, *, approved: bool, skip: bool = False) -> RunHandle | None:
        """Answer a pending interrupt and resume the run in the background."""
        handle = self._runs.get(run_id)
        if handle is None or handle.phase != "waiting_for_approval":
            return None
        handle.phase = "running"
        handle.interrupt_payload = None
        self._launch(run_id, Command(resume={"approved": approved, "skip": skip}))
        return handle

    def subscribe(self, run_id: str) -> asyncio.Queue[DomainEvent]:
        """Register a queue that receives this run's events, history included."""
        return self._event_sinks.setdefault(run_id, _QueueSink()).attach()

    def unsubscribe(self, run_id: str, queue: asyncio.Queue[DomainEvent]) -> None:
        sink = self._event_sinks.get(run_id)
        if sink and queue in sink.queues:
            sink.queues.remove(queue)

    # ── internals ───────────────────────────────────────────────────────

    def _launch(self, run_id: str, graph_input: Any) -> None:
        task = asyncio.create_task(self._drive(run_id, graph_input))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _drive(self, run_id: str, graph_input: Any) -> None:
        handle = self._runs[run_id]
        queue_sink = self._event_sinks.setdefault(run_id, _QueueSink())
        events = EventBus([queue_sink, JsonlTraceSink(self._traces_dir / f"{run_id}.jsonl")])
        provider = self._llm_factory(self._settings, events)
        sandbox = LocalProcessSandbox(self._workspaces_dir / run_id, events=events)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            async with AsyncSqliteSaver.from_conn_string(str(self._db_path)) as saver:
                graph = build_graph(provider, sandbox, checkpointer=saver, events=events)
                config = {"configurable": {"thread_id": run_id}}
                result = await graph.ainvoke(graph_input, config)

            interrupts = result.get("__interrupt__")
            handle.state = GraphState.model_validate(result)
            if interrupts:
                handle.phase = "waiting_for_approval"
                handle.interrupt_payload = interrupts[0].value
            else:
                handle.phase = "finished"
        except Exception as exc:  # surfaced via GET /runs/{id}, not swallowed
            handle.phase = "failed"
            handle.error = f"{type(exc).__name__}: {exc}"
        finally:
            aclose = getattr(provider, "aclose", None)
            if aclose is not None:
                await aclose()
