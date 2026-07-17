# OrchestrAI — Backend

The entire Python application. Follows Clean Architecture — but the repository
only contains files that are actually in use. Layers appear on disk when the
first real code needs them (see "Target architecture" below for where things
will live).

## Current state (M0)

```
backend/
├── pyproject.toml           # deps + ruff (lint & format) + mypy strict + pytest
├── src/orchestrai/
│   ├── __init__.py          # package marker + version
│   └── config.py            # pydantic-settings (ORCHESTRAI_ env prefix)
└── tests/
    └── unit/
        └── test_config.py
```

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
