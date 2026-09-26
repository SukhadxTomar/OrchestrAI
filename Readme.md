# OrchestrAI

An autonomous software engineer, built from a crew of specialized AI agents.

You describe what you want in plain English, and OrchestrAI takes it from there — reads the requirements, plans the work, writes the code, runs the tests, fixes what breaks, reviews the result, and writes the docs. It pauses for your approval at the points that actually matter. The goal isn't to autocomplete a function, it's to run the whole software development lifecycle.

Orchestration is built on LangGraph, so every run is a checkpointed state machine underneath. You can watch it live, approve or reject its decisions, kill it mid-run, and resume later from disk.

## What it actually does

Give it something like:

```text
Build a Todo API using FastAPI and PostgreSQL.

Features:
- JWT authentication
- CRUD
- Docker
- Swagger
- Unit tests
```

and here's what happens behind the scenes:

1. **Analyze** — turns the prompt into a structured requirement spec, and flags anything ambiguous instead of guessing.
2. **Plan** — breaks the spec into a validated task DAG.
3. **Code** — implements each task in dependency order, writing real files into a sandboxed workspace.
4. **Verify** — compiles the code, installs dependencies, runs the tests.
5. **Debug** — when tests fail, diagnoses the cause and patches it, up to a retry limit.
6. **Review** — judges the finished project and writes its README.

You sign off on the spec and the plan before anything gets built, and a budget check runs before every task — if a run would blow past its cost ceiling, it halts cleanly instead of quietly burning money.

## The pipeline

```text
prompt
  │
  ▼
Analyst  ──►  requirement spec
  │
  ▼
[ you approve the spec ]
  │
  ▼
Planner  ──►  validated task DAG        (invalid graph → one self-correction retry)
  │
  ▼
[ you approve the plan ]
  │
  ▼
for each task, in dependency order:
  │
  ├─ budget checkpoint  ──►  over budget? halt cleanly
  ├─ Coder    ──►  writes real files into a sandboxed workspace
  ├─ Verify   ──►  compile → install deps → run tests
  └─ tests fail?  ──►  Debugger patches and re-verifies
                        (bounded retries; on exhaustion it escalates → you skip or abort)
  │
  ▼
Reviewer  ──►  verdict, findings, and a generated README
```

## The agents

Each agent is kept deliberately thin — a system prompt, an output schema, and only the tools it's allowed to touch.

- **Analyst** — turns your prompt into a structured requirement spec.
- **Planner** — turns the spec into a validated task DAG, and self-corrects when the graph comes back with cycles or dangling dependencies.
- **Coder** — implements one task at a time, writing complete files through the sandbox with full context of what came before.
- **Debugger** — takes a verification failure and the relevant files and comes back with a root-cause hypothesis plus a patch.
- **Reviewer** — reads the whole project and hands back a verdict, a list of findings, and a generated README.

Verification itself isn't an agent — it's a plain pipeline (compile, install, then pytest) that fails fast and hands anything broken straight to the debugger.

## Architecture

Clean architecture, ports and adapters — business logic stays independent of frameworks and infrastructure, and dependencies only ever point inward.

```text
Interfaces      CLI, HTTP + WebSocket API
    │
    ▼
Orchestration   LangGraph graph, state, and routing
    │
    ▼
Application      agents, services, and the ports they depend on
    │
    ▼
Domain          pure business models and rules — depends on nothing
```

Infrastructure sits on the outside and implements the application's ports: OpenRouter for the LLM, a path-jailed local sandbox for execution, SQLite for checkpoints, telemetry sinks for the event stream. Full file-by-file map is in `docs/ARCHITECTURE.md`.

## Tech stack

**Backend**

- Python 3.12+
- LangGraph (with SQLite checkpointing) for orchestration
- FastAPI + Uvicorn for the HTTP/WebSocket API
- Typer for the CLI
- Pydantic v2 + pydantic-settings for models and config
- httpx talking to OpenRouter for the LLM
- Rich + structlog for output and logging
- Ruff (lint/format), Mypy (strict), Pytest for quality

**Frontend**

- React, TypeScript, Vite
- Zustand for state, Monaco for the code viewer, Tailwind for styling

## Getting started

From the terminal:

```bash
cd backend
uv sync
uv run orchestrai run "Build a Todo API with FastAPI and JWT auth"
# a spec appears and the run pauses for approval, then:
uv run orchestrai resume <run-id> --approve
```

Or drive it over HTTP:

```bash
cd backend
uv run uvicorn orchestrai.interfaces.api.app:create_app --factory --reload
# interactive docs at http://127.0.0.1:8000/docs
```

Or the web console:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The frontend actually runs fine with no backend at all — a built-in simulation speaks the same event grammar, so every screen is live from the start — and it switches over to real runs automatically the moment the API comes up. More detail in `backend/README.md` and `frontend/README.md`.

## Repository layout

```text
OrchestrAI/
├── backend/     Python engine: agents, orchestration, sandbox, CLI + API
├── frontend/    React console for watching and approving runs
├── docs/        architecture notes
└── .github/     CI (backend quality gates)
```

## Where things stand

The full lifecycle works end to end today: analyze, plan, code, verify, self-heal, review — with human approval gates, cost control, checkpoint/resume, and both a CLI and an HTTP/WebSocket API sitting over the same engine. 121 tests total, 116 of which run offline for free, plus an opt-in set of golden-prompt evals against a real LLM.

It's an honest MVP, not a finished product. Known gaps:

- Generated code runs in the orchestrator's own Python environment — Docker isolation isn't wired up yet.
- No auth or multi-user story on the API.
- The run registry is in-process and single-node.

## Ideas for later

- Docker-isolated execution
- Support for multiple LLM providers
- RAG over technical documentation
- GitHub pull request generation
- Browser automation and MCP tools
- Long-term memory across runs
- Multi-project management and distributed agents
