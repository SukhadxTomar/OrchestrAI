# OrchestrAI — Backend

The entire Python application. Follows Clean Architecture — but the repository
only contains files that are actually in use. Layers appear on disk when the
first real code needs them (see "Target architecture" below for where things
will live).

## Current state (M2 — LLM port + adapters)

```
backend/
├── pyproject.toml           # deps + ruff (lint & format) + mypy strict + pytest
├── src/orchestrai/
│   ├── config.py            # pydantic-settings (ORCHESTRAI_ env prefix)
│   ├── domain/              # pure business rules — no I/O, no frameworks
│   │   ├── errors.py        # DomainError hierarchy (business rule violations)
│   │   └── models/
│   │       ├── budget.py            # immutable spend tracking; exhausted → halt
│   │       ├── task.py              # task lifecycle state machine; bounded retry
│   │       ├── plan.py              # task DAG; cycle/dangling-dep validation
│   │       └── requirement_spec.py  # Analyst output; ambiguity union (resolved|open)
│   ├── application/
│   │   └── ports/
│   │       └── llm.py       # LLMProvider Protocol + Message/Usage/LLMResponse
│   └── infrastructure/
│       └── llm/
│           ├── openrouter.py  # real adapter: structured output, parse-retry, cost
│           ├── fake.py        # deterministic test double (queued responses)
│           └── smoke.py       # manual live check (real API, tiny cost)
└── tests/
    └── unit/                # mirrors src; domain at 100% coverage
```

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
