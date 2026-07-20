# OrchestrAI — Backend

The entire Python application. Follows Clean Architecture — but the repository
only contains files that are actually in use. Layers appear on disk when the
first real code needs them (see "Target architecture" below for where things
will live).

## Current state (M10 — FastAPI control plane)

Two interfaces over one engine — CLI for the terminal, HTTP+WebSocket for
any frontend:

```
POST /runs                  start a run            → 202 {run_id}
GET  /runs/{id}             status, spec/plan, cost, review verdict
POST /runs/{id}/approvals   {"decision": "approve" | "reject" | "skip" | "abort"}
WS   /runs/{id}/events      live event stream (history replayed on connect)
```

Run the API:

```bash
uv run uvicorn orchestrai.interfaces.api.app:create_app --factory --reload
# interactive docs at http://127.0.0.1:8000/docs
```

The full SDLC runs end-to-end, and the platform now proves itself:

```
prompt → analyze → [spec approval] → plan (invalid-DAG retry) → [plan approval]
      → select_task (BUDGET CHECKPOINT) ⇄ code → verify ⇄ debug
      → [escalation gate: skip/abort]  → review → README generation
Budget exhausted at any checkpoint → status "halted", zero further spend.
```

- `tests/evals/` — golden-prompt evals against a real LLM (`pytest tests/evals -m eval`,
  needs an API key; skipped otherwise). Asserts outcomes: project built,
  verification passed, cost within budget.
- Planner feeds structurally invalid drafts (cycles, dangling deps) back to
  the model for one correction round before failing.
- 116 tests run free and offline; evals are the only paid suite.

```
backend/
├── src/orchestrai/
│   ├── config.py
│   ├── domain/              # errors, events, models (budget/task/plan/spec/
│   │                        #   artifact/verification)
│   ├── application/
│   │   ├── event_bus.py
│   │   ├── ports/           # llm, events, sandbox
│   │   └── services/        # verification.py
│   ├── agents/              # analyst, planner, coder, debugger, reviewer
│   ├── orchestration/       # state.py, graph.py (full self-healing SDLC)
│   ├── infrastructure/
│   │   ├── llm/             # openrouter, fake, smoke
│   │   ├── sandbox/         # local.py (path-jailed subprocess)
│   │   └── telemetry/       # sinks.py
│   └── interfaces/
│       ├── cli.py           # run / resume --approve|--reject|--skip|--abort
│       └── api/             # app.py (FastAPI routes) + run_manager.py
│                            #   (background runs, event fan-out)
└── tests/                   # unit + integration (111 tests)
```

## Try it

```bash
cd backend
uv run orchestrai run "Build a Todo API with FastAPI and JWT auth"
# → spec appears, run pauses; then:
uv run orchestrai resume <run-id> --approve
# → validated task plan + total cost
```

Runtime artifacts land in `runs/` (checkpoints) and `traces/` (event log),
both git-ignored.

Domain models `Artifact`, `VerificationResult`, and domain events are
deliberately absent — each will be created in the milestone that first
uses it (M6, M7, M2/M3 respectively).

## Target architecture (realized incrementally, dependencies point inward)

| Layer (future folder)          | Responsibility                                        |
| ------------------------------ | ----------------------------------------------------- |
| `domain/`                      | Pure business models & rules — no I/O, no frameworks  |
| `application/`                 | Use cases, services, and ports (Protocols)            |
| `agents/`                      | Thin agents: prompt + output schema + allowed tools   |
| `orchestration/`               | LangGraph graph, state, nodes, routing                |
| `infrastructure/`              | Adapters: LLM providers, sandbox, persistence, git    |
| `interfaces/`                  | CLI first, FastAPI control plane later                |

## Setup

```bash
cd backend
uv sync                 # create .venv and install all deps
uv run pytest           # run tests
uv run ruff check .     # lint
uv run ruff format .    # format
uv run mypy             # type-check
```

Copy `.env.example` to `.env` and fill in secrets. `.env` is git-ignored.
