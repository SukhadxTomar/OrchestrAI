"""OrchestrAI CLI: run and resume graph executions from the terminal.

uv run orchestrai run "Build a Todo API with FastAPI and JWT auth"
uv run orchestrai resume <run-id> --approve
"""

import asyncio
import sqlite3
import uuid
from decimal import Decimal
from pathlib import Path
from typing import Any

import typer
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command
from rich.console import Console
from rich.panel import Panel

from orchestrai.application.event_bus import EventBus
from orchestrai.config import Settings
from orchestrai.domain.models.budget import Budget
from orchestrai.infrastructure.llm.openrouter import OpenRouterProvider
from orchestrai.infrastructure.sandbox.local import LocalProcessSandbox
from orchestrai.infrastructure.telemetry.sinks import ConsoleSink, JsonlTraceSink
from orchestrai.orchestration.graph import build_graph
from orchestrai.orchestration.state import GraphState

app = typer.Typer(no_args_is_help=True, add_completion=False)
console = Console()

_DB_PATH = Path("runs/checkpoints.sqlite")
_TRACES_DIR = Path("traces")
_WORKSPACES_DIR = Path("workspaces")


async def _drive(run_id: str, graph_input: Any, settings: Settings) -> None:
    """Run the graph until it finishes or interrupts, rendering the outcome."""
    events = EventBus([ConsoleSink(), JsonlTraceSink(_TRACES_DIR / f"{run_id}.jsonl")])
    provider = OpenRouterProvider(
        api_key=settings.openrouter_api_key.get_secret_value(),
        model=settings.openrouter_model,
        events=events,
    )
    sandbox = LocalProcessSandbox(_WORKSPACES_DIR / run_id, events=events)
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        async with AsyncSqliteSaver.from_conn_string(str(_DB_PATH)) as saver:
            graph = build_graph(provider, sandbox, checkpointer=saver, events=events)
            config = {"configurable": {"thread_id": run_id}}
            result = await graph.ainvoke(graph_input, config)
            _render(run_id, result)
    finally:
        await provider.aclose()


def _render(run_id: str, result: dict[str, Any]) -> None:
    interrupts = result.get("__interrupt__")
    if interrupts:
        payload = interrupts[0].value
        title = payload.get("question", "Approval needed")
        if "tasks" in payload:  # plan gate
            lines = []
            for t in payload["tasks"]:
                deps = f"  (after {', '.join(t['depends_on'])})" if t["depends_on"] else ""
                lines.append(f"[bold]{t['id']}[/bold]: {t['description']}{deps}")
            console.print(Panel("\n".join(lines), title=title))
        else:  # spec gate
            state = GraphState.model_validate(result)
            assert state.spec is not None
            spec = state.spec
            lines = [f"[bold]{spec.summary}[/bold]", ""]
            lines += [f"  • {r}" for r in spec.functional_requirements]
            if spec.tech_stack:
                lines += ["", f"stack: {', '.join(spec.tech_stack)}"]
            for amb in spec.ambiguities:
                mark = "[yellow]open[/yellow]" if amb.kind == "open" else "[dim]resolved[/dim]"
                lines += ["", f"[{mark}] {amb.question}"]
            console.print(Panel("\n".join(lines), title=title))
        console.print(
            f"\nrun id: [bold cyan]{run_id}[/bold cyan]\n"
            f"  approve: [green]uv run orchestrai resume {run_id} --approve[/green]\n"
            f"  reject:  [red]uv run orchestrai resume {run_id} --reject[/red]"
        )
        return

    state = GraphState.model_validate(result)
    if state.status == "reviewed":
        lines = [f"[bold]{a.path}[/bold]  (task {a.task_id})" for a in state.artifacts]
        console.print(Panel("\n".join(lines) or "no files", title="Generated project"))
        if state.review is not None:
            verdict = state.review.verdict
            color = "green" if verdict == "approve" else "yellow"
            body = [f"verdict: [{color}]{verdict}[/{color}]"]
            body += [f"  • [bold]{f.file}[/bold]: {f.issue}" for f in state.review.findings]
            console.print(Panel("\n".join(body), title="Review"))
        console.print(f"workspace: [bold]{_WORKSPACES_DIR / run_id}[/bold]")
    console.print(f"status: [bold]{state.status}[/bold]   total cost: ${state.total_cost_usd}")


@app.command()
def run(
    prompt: str,
    budget: float = typer.Option(5.0, help="Max spend in USD for this run."),
) -> None:
    """Start a new run from a natural-language prompt."""
    settings = Settings()
    if not settings.openrouter_api_key.get_secret_value():
        console.print("[red]ORCHESTRAI_OPENROUTER_API_KEY missing — put it in backend/.env[/red]")
        raise typer.Exit(1)
    run_id = uuid.uuid4().hex[:8]
    console.print(f"starting run [bold cyan]{run_id}[/bold cyan]\n")
    initial = GraphState(prompt=prompt, budget=Budget(limit_usd=Decimal(str(budget))))
    asyncio.run(_drive(run_id, initial.model_dump(), settings))


@app.command()
def resume(
    run_id: str,
    approve: bool = typer.Option(False, "--approve", help="Approve the pending gate."),
    reject: bool = typer.Option(False, "--reject", help="Reject the pending gate."),
    skip: bool = typer.Option(False, "--skip", help="Skip an escalated task and continue."),
    abort: bool = typer.Option(False, "--abort", help="Abort the run at an escalated task."),
) -> None:
    """Answer a pending gate (approval or escalation) and continue a run."""
    chosen = [approve, reject, skip, abort]
    if sum(chosen) != 1:
        console.print("[red]pass exactly one of --approve / --reject / --skip / --abort[/red]")
        raise typer.Exit(1)
    if not _DB_PATH.exists() or not _run_exists(run_id):
        console.print(f"[red]unknown run id: {run_id}[/red]")
        raise typer.Exit(1)
    answer = {"approved": approve, "skip": skip}
    asyncio.run(_drive(run_id, Command(resume=answer), Settings()))


def _run_exists(run_id: str) -> bool:
    with sqlite3.connect(_DB_PATH) as conn:
        row = conn.execute(
            "SELECT 1 FROM checkpoints WHERE thread_id = ? LIMIT 1", (run_id,)
        ).fetchone()
    return row is not None


if __name__ == "__main__":
    app()
