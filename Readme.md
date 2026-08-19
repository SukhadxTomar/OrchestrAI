# OrchestrAI

An autonomous software engineer built from a team of specialized AI agents.

Describe what you want in plain English and OrchestrAI takes it from there: it reads the
requirements, plans the work, writes the code, runs the tests, fixes what breaks, reviews
the result, and writes the docs — pausing for your approval at the points that matter. The
goal is to run the whole software development lifecycle, not just autocomplete a function.

Orchestration is built on LangGraph, so a run is a checkpointed state machine. You can
watch it live, approve or reject its decisions, kill it mid-run, and resume from disk.

## What it does

Give it a prompt like:

```text
Build a Todo API using FastAPI and PostgreSQL.

Features:
- JWT authentication
- CRUD
- Docker
- Swagger
- Unit tests
```

and a run walks through:

1. **Analyze** — turn the prompt into a structured requirement spec, flagging anything ambiguous.
2. **Plan** — break the spec into a validated task DAG.
3. **Code** — implement each task in dependency order, writing real files into a sandboxed workspace.
4. **Verify** — compile the code, install dependencies, and run the tests.
5. **Debug** — when tests fail, diagnose the cause and patch, bounded by a retry limit.
6. **Review** — judge the finished project and generate its README.

You sign off on the spec and the plan before the build begins, and a budget checkpoint runs
before every task. If a run would exceed its cost ceiling, it halts cleanly instead of
spending more.

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

Each agent is deliberately thin: a system prompt, an output schema, and the tools it's
allowed to touch.

- **Analyst** — turns the user's prompt into a structured requirement spec.
- **Planner** — turns the spec into a validated task DAG, and self-corrects when the graph comes back with cycles or dangling dependencies.
- **Coder** — implements one task at a time, writing complete files through the sandbox with the context of what came before.
- **Debugger** — takes a verification failure and the relevant files and produces a root-cause hypothesis plus a patch.
- **Reviewer** — reads the whole project and returns a verdict, a list of findings, and a generated README.

Verification itself isn't an agent — it's a plain pipeline (compile, then install, then
pytest) that fails fast and hands any failure to the debugger.

## Architecture

The project follows clean architecture with ports and adapters, so the business logic stays
independent of frameworks and infrastructure. Dependencies only ever point inward.

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

Infrastructure sits on the outside and implements the application's ports: OpenRouter for
the LLM, a path-jailed local sandbox for execution, SQLite for checkpoints, and telemetry
sinks for the event stream. See `docs/ARCHITECTURE.md` for the full file-by-file map.

## Tech stack

**Backend**

- Python 3.12+
- LangGraph, with SQLite checkpointing, for orchestration
- FastAPI and Uvicorn for the HTTP/WebSocket API
- Typer for the CLI
- Pydantic v2 and pydantic-settings for models and config
- httpx talking to OpenRouter for the LLM
- Rich and structlog for output and logging
- Ruff (lint and format), Mypy (strict), and Pytest for quality

**Frontend**

- React, TypeScript, and Vite
- Zustand for state, Monaco for the code viewer, Tailwind for styling

## Getting started

Run it from the terminal:

```bash
cd backend
uv sync
uv run orchestrai run "Build a Todo API with FastAPI and JWT auth"
# a spec appears and the run pauses for approval, then:
uv run orchestrai resume <run-id> --approve
```

Or run the API and drive it over HTTP:

```bash
cd backend
uv run uvicorn orchestrai.interfaces.api.app:create_app --factory --reload
# interactive docs at http://127.0.0.1:8000/docs
```

And the web console:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The frontend runs on its own with no backend — a built-in simulation speaks the same event
grammar, so every screen is live — and it switches to real runs automatically once the API
is up. There's more detail in `backend/README.md` and `frontend/README.md`.

## Repository layout

```text
OrchestrAI/
├── backend/     Python engine: agents, orchestration, sandbox, CLI + API
├── frontend/    React console for watching and approving runs
├── docs/        architecture notes
└── .github/     CI (backend quality gates)
```

## Project status

The full lifecycle works end to end today — analyze, plan, code, verify, self-heal, and
review — with human approval gates, cost control, checkpoint and resume, and both a CLI and
an HTTP/WebSocket API over the same engine. The test suite has 121 tests: 116 run offline
for free, and an opt-in set runs golden-prompt evals against a real LLM.

It's an honest MVP, not a finished product. The main gaps:

- Generated code runs in the orchestrator's own Python environment; Docker isolation isn't wired up yet.
- The API has no authentication or multi-user story.
- The run registry is in-process and single-node.

## Ideas for later

- Docker-isolated execution
- Support for multiple LLM providers
- RAG over technical documentation
- GitHub pull request generation
- Browser automation and MCP tools
- Long-term memory across runs
- Multi-project management and distributed agents

## Contributing

Contributions, questions, and architecture suggestions are all welcome. This is an
exploration of what production-grade autonomous software engineering can look like with
modern agent orchestration, so discussion about the design is as useful as code.

## License

Released under the MIT License.
