# OrchestrAI — Backend

The entire Python application. Follows Clean Architecture — but the repository
only contains files that are actually in use. Layers appear on disk when the
first real code needs them (see "Target architecture" below for where things
will live).

## Current state (M4 — first LangGraph slice)

```
backend/
├── pyproject.toml           # deps + tools config + `orchestrai` CLI entry point
├── src/orchestrai/
│   ├── config.py            # pydantic-settings (ORCHESTRAI_ env prefix)
│   ├── domain/              # pure business rules — no I/O, no frameworks
│   │   ├── errors.py        # DomainError hierarchy
│   │   ├── events.py        # frozen facts: LLMCallCompleted
│   │   └── models/          # budget, task, plan, requirement_spec
│   ├── application/
│   │   ├── event_bus.py     # fan-out to sinks; sink failures isolated
│   │   └── ports/           # llm.py (LLMProvider), events.py (EventSink)
│   ├── agents/
│   │   ├── analyst.py       # prompt → RequirementSpec
│   │   └── planner.py       # spec → PlanDraft → validated Plan (DAG)
│   ├── orchestration/
│   │   ├── state.py         # GraphState: travels through the graph, checkpointable
│   │   └── graph.py         # analyze → approval_gate (interrupt) → plan
│   ├── infrastructure/
│   │   ├── llm/             # openrouter.py, fake.py, smoke.py
│   │   └── telemetry/       # sinks.py: ConsoleSink + JsonlTraceSink
│   └── interfaces/
│       └── cli.py           # typer+rich: `orchestrai run` / `orchestrai resume`
└── tests/
    ├── unit/                # mirrors src; domain at 100% coverage
    └── integration/         # full graph runs on FakeLLM: pause/approve/reject/resume
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
