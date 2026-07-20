# OrchestrAI


## 1. Repository Tree

```
OrchestrAI
├── Readme.md                      # project vision + target architecture
├── .gitignore
├── .github/
│   └── workflows/
│       └── backend-ci.yml         # CI: ruff → format-check → mypy → pytest
│
├── frontend/
│   └── README.md                  # framework-agnostic placeholder + API contract
│
└── backend/
    ├── pyproject.toml             # deps + ruff/mypy(strict)/pytest config + CLI entry
    ├── README.md                  # current-state map + run instructions
    │
    ├── src/orchestrai/
    │   ├── __init__.py            # package marker + version
    │   ├── config.py              # Settings: env-driven config, SecretStr API key
    │   │
    │   ├── domain/                          ── DOMAIN LAYER ──
    │   │   ├── errors.py          # DomainError hierarchy (business rule violations)
    │   │   ├── events.py          # frozen facts: LLM/file/command/task events
    │   │   └── models/
    │   │       ├── budget.py            # immutable spend tracking; exhausted → halt
    │   │       ├── task.py              # lifecycle state machine + bounded retry
    │   │       ├── plan.py              # task DAG; cycle detection; scheduling
    │   │       ├── requirement_spec.py  # Analyst output; ambiguity union
    │   │       ├── artifact.py          # produced file ↔ producing task
    │   │       └── verification.py      # pass/fail interpretation of checks
    │   │
    │   ├── application/                     ── APPLICATION LAYER ──
    │   │   ├── event_bus.py       # fan-out to sinks; sink failures isolated
    │   │   ├── ports/
    │   │   │   ├── llm.py         # LLMProvider Protocol + Message/Usage/LLMResponse
    │   │   │   ├── events.py      # EventSink Protocol
    │   │   │   └── sandbox.py     # Sandbox Protocol + ExecutionResult + violations
    │   │   └── services/
    │   │       └── verification.py  # syntax → deps → pytest pipeline (fail-fast)
    │   │
    │   ├── agents/                          ── AGENTS ──
    │   │   ├── analyst.py         # prompt → RequirementSpec
    │   │   ├── planner.py         # spec → validated Plan (invalid-DAG retry)
    │   │   ├── coder.py           # one task → complete files via sandbox
    │   │   ├── debugger.py        # failure + files → hypothesis + patch
    │   │   └── reviewer.py        # whole project → verdict + findings + README
    │   │
    │   ├── orchestration/                   ── ORCHESTRATION ──
    │   │   ├── state.py           # GraphState: checkpointable run state
    │   │   └── graph.py           # LangGraph assembly: full self-healing SDLC
    │   │
    │   ├── infrastructure/                  ── INFRASTRUCTURE ──
    │   │   ├── llm/
    │   │   │   ├── openrouter.py  # real provider: structured output, parse-retry
    │   │   │   ├── fake.py        # deterministic test double
    │   │   │   └── smoke.py       # manual live check script
    │   │   ├── sandbox/
    │   │   │   └── local.py       # path-jailed subprocess sandbox
    │   │   └── telemetry/
    │   │       └── sinks.py       # ConsoleSink + JsonlTraceSink
    │   │
    │   └── interfaces/                      ── INTERFACES ──
    │       ├── cli.py             # typer CLI: run / resume
    │       └── api/
    │           ├── app.py         # FastAPI routes + WebSocket streaming
    │           └── run_manager.py # background run lifecycle + event fan-out
    │
    └── tests/
        ├── unit/                  # mirrors src (domain, application, agents, infra)
        ├── integration/           # full-graph + full-API runs on FakeLLM
        └── evals/                 # golden-prompt e2e against real LLMs (opt-in)
```

---

## 2. File Catalog

### Domain layer (pure business rules — no I/O, no frameworks)

| File | Purpose | Introduced | Major updates |
|---|---|---|---|
| `domain/models/budget.py` | Immutable spend tracker; "budget exhausted → halt" rule | M1 | — |
| `domain/models/task.py` | Task lifecycle state machine (pending→…→verified/escalated), bounded retry | M1 | — |
| `domain/models/plan.py` | Validated task DAG: cycle/dangling-dep rejection, `next_ready_task()` | M1 | M6 (`with_updated_task`) |
| `domain/models/requirement_spec.py` | Analyst output; `Ambiguity` discriminated union (resolved\|open) | M1 | — |
| `domain/models/artifact.py` | Records which task produced which file | M6 | — |
| `domain/models/verification.py` | `VerificationResult`/`CheckFailure`: business meaning of check outcomes | M7 | — |
| `domain/errors.py` | `DomainError` hierarchy: budget/transition/plan violations | M1 | grew with each model |
| `domain/events.py` | Frozen, timestamped facts (LLM call, file written, task verified…) | M3 | M5 (sandbox events), M7 (task events) |

### Application layer (use cases, ports, pure coordination)

| File | Purpose | Introduced | Major updates |
|---|---|---|---|
| `application/ports/llm.py` | `LLMProvider` Protocol; typed request/response with cost | M2 | — |
| `application/ports/events.py` | `EventSink` Protocol (listener contract) | M3 | — |
| `application/ports/sandbox.py` | `Sandbox` Protocol: jailed file I/O + command exec | M5 | — |
| `application/event_bus.py` | Fan-out of events to sinks; broken sink cannot kill the run | M3 | — |
| `application/services/verification.py` | Check pipeline: compileall → pip install → pytest, fail-fast | M7 | — |

### Agents (thin: system prompt + output schema + LLM call)

| File | Purpose | Introduced | Major updates |
|---|---|---|---|
| `agents/analyst.py` | User prompt → structured `RequirementSpec` | M4 | — |
| `agents/planner.py` | Spec → task DAG; feeds domain validation errors back to the model | M4 | M9 (invalid-DAG retry) |
| `agents/coder.py` | One task → complete files, written through the sandbox | M6 | — |
| `agents/debugger.py` | Verification failure + own files → root-cause hypothesis + patch | M7 | — |
| `agents/reviewer.py` | Whole project → verdict + findings + generated README.md | M8 | — |

### Orchestration (LangGraph engine — deliberately not abstracted)

| File | Purpose | Introduced | Major updates |
|---|---|---|---|
| `orchestration/state.py` | `GraphState`: everything a run knows; JSON-checkpointable | M4 | M6 (artifacts), M7 (verification), M8 (review), M9 (halted) |
| `orchestration/graph.py` | Node/edge assembly: gates, task loop, verify⇄debug, review | M4 | M6 (task loop), M7 (self-healing), M8 (review), M9 (budget checkpoints) |

### Infrastructure (adapters fulfilling ports)

| File | Purpose | Introduced | Major updates |
|---|---|---|---|
| `infrastructure/llm/openrouter.py` | Real LLM over HTTP: structured outputs, parse-retry with error feedback, cost capture | M2 | M3 (event emission) |
| `infrastructure/llm/fake.py` | Deterministic test double: queued responses, records calls | M2 | — |
| `infrastructure/llm/smoke.py` | Manual live smoke check (costs real money, not in pytest) | M2 | M3 (event wiring) |
| `infrastructure/sandbox/local.py` | Path-jailed subprocess sandbox; timeout kill; emits events | M5 | — |
| `infrastructure/telemetry/sinks.py` | ConsoleSink (live view) + JsonlTraceSink (flight recorder) | M3 | — |

### Interfaces (two doors, one engine)

| File | Purpose | Introduced | Major updates |
|---|---|---|---|
| `interfaces/cli.py` | Terminal driver: `run` / `resume --approve\|--reject\|--skip\|--abort` | M4 | M6 (workspaces), M7 (escalation flags), M8 (review render) |
| `interfaces/api/app.py` | FastAPI control plane: POST/GET runs, approvals, WS event stream | M10 | — |
| `interfaces/api/run_manager.py` | Background run lifecycle; per-run event queues with history replay | M10 | — |

### Configuration & tooling

| File | Purpose | Introduced | Major updates |
|---|---|---|---|
| `config.py` | `Settings` via pydantic-settings; `SecretStr` API key | M0 | M2 (model selection) |
| `pyproject.toml` | Dependencies + ruff/mypy-strict/pytest config + CLI entry point | M0 | every milestone (deps) |
| `.github/workflows/backend-ci.yml` | Quality gates on every push/PR (path-filtered to backend) | M0 | — |

### Tests (121 test functions; unit mirrors src)

| File | Covers | Introduced |
|---|---|---|
| `tests/unit/test_config.py` | Settings loading, secret non-leakage | M0 |
| `tests/unit/domain/test_budget.py` | Spend rules, exhaustion, Decimal exactness | M1 |
| `tests/unit/domain/test_task.py` | Legal/illegal transitions, retry bounds | M1 |
| `tests/unit/domain/test_plan.py` | DAG validation, cycles, scheduling | M1 |
| `tests/unit/domain/test_requirement_spec.py` | Discriminated union parsing, round-trip | M1 |
| `tests/unit/domain/test_plan_updates.py` | Immutable task replacement | M6 |
| `tests/unit/infrastructure/test_fake_llm.py` | Test-double behaviour, Protocol satisfaction | M2 |
| `tests/unit/infrastructure/test_openrouter.py` | HTTP adapter (respx): retries, errors, cost, events | M2, M3 (events) |
| `tests/unit/application/test_event_bus.py` | Fan-out, broken-sink isolation | M3 |
| `tests/unit/infrastructure/test_telemetry_sinks.py` | Console format, JSONL validity | M3 |
| `tests/unit/infrastructure/test_local_sandbox.py` | Jail attack tests, timeout kill, events | M5 |
| `tests/unit/application/test_verification_service.py` | Check pipeline on real subprocesses | M7 |
| `tests/unit/agents/test_planner_retry.py` | Invalid-DAG feedback loop | M9 |
| `tests/integration/test_graph.py` | Full graph on FakeLLM: gates, loop, self-healing, escalation, budget halt, resume | M4 → M9 (grew each milestone) |
| `tests/integration/test_api.py` | Full SDLC over HTTP; 404/409; event subscription | M10 |
| `tests/evals/test_golden_prompts.py` | Real-LLM golden-prompt outcome checks (opt-in, paid) | M9 |

---

## 3. Dependency Graph

```
        ┌─────────────┐        ┌──────────────────────────────┐
        │  CLI (typer) │        │  FastAPI app  ← any frontend │
        └──────┬───────┘        └──────┬───────────────────────┘
               │                       │
               │              ┌────────▼─────────┐
               │              │    RunManager     │  background tasks,
               │              │                   │  event queues (WS)
               └──────┬───────┴────────┬──────────┘
                      ▼                ▼
              ┌───────────────────────────────┐
              │   orchestration/graph.py      │  LangGraph: gates,
              │   (uses state.py)             │  task loop, self-healing
              └───┬────────┬─────────┬────────┘
                  ▼        ▼         ▼
            ┌────────┐ ┌────────────────┐ ┌──────────────────────┐
            │ agents │ │ Verification   │ │ EventBus             │
            │ (5)    │ │ Service        │ │  ├─ ConsoleSink      │
            └───┬────┘ └───────┬────────┘ │  ├─ JsonlTraceSink   │
                │              │          │  └─ QueueSink (API)  │
        ┌───────┴────┐         │          └──────────▲───────────┘
        ▼            ▼         ▼                     │ events
┌──────────────┐ ┌──────────────────┐                │
│ LLMProvider  │ │ Sandbox (port)   │────────────────┘
│ (port)       │ └────────┬─────────┘
└──────┬───────┘          ▼
       ▼         ┌──────────────────────┐
┌──────────────┐ │ LocalProcessSandbox  │  path jail, subprocess,
│ OpenRouter / │ │ (workspaces/<run>)   │  timeout kill
│ FakeLLM      │ └──────────────────────┘
└──────────────┘
       │  everything above depends inward on:
       ▼
┌──────────────────────────────────────────────┐
│ domain/ — Budget, Task, Plan, RequirementSpec │  pure rules,
│           Artifact, Verification, Events      │  zero dependencies
└──────────────────────────────────────────────┘
```

Dependency rule: arrows only point inward (interfaces → orchestration →
application → domain). Infrastructure implements application ports; the
domain imports nothing from any other layer.

---

## 4. Files by Milestone

**M0 — Foundation**
- `pyproject.toml`, `config.py`, `.github/workflows/backend-ci.yml`, `.gitignore`, `frontend/README.md`, `tests/unit/test_config.py`

**M1 — Domain core**
- `domain/models/{budget,task,plan,requirement_spec}.py`, `domain/errors.py`, `tests/unit/domain/test_{budget,task,plan,requirement_spec}.py`

**M2 — LLM port + adapters**
- `application/ports/llm.py`, `infrastructure/llm/{openrouter,fake,smoke}.py`, `tests/unit/infrastructure/test_{fake_llm,openrouter}.py`

**M3 — Event system + observability**
- `domain/events.py`, `application/ports/events.py`, `application/event_bus.py`, `infrastructure/telemetry/sinks.py`, `tests/unit/application/test_event_bus.py`, `tests/unit/infrastructure/test_telemetry_sinks.py`

**M4 — First LangGraph slice**
- `agents/{analyst,planner}.py`, `orchestration/{state,graph}.py`, `interfaces/cli.py`, `tests/integration/test_graph.py`

**M5 — Sandbox + workspace**
- `application/ports/sandbox.py`, `infrastructure/sandbox/local.py`, `tests/unit/infrastructure/test_local_sandbox.py`

**M6 — Coder + task loop**
- `domain/models/artifact.py`, `agents/coder.py`, `tests/unit/domain/test_plan_updates.py` (+ graph/state/CLI extensions)

**M7 — Self-healing loop**
- `domain/models/verification.py`, `application/services/verification.py`, `agents/debugger.py`, `tests/unit/application/test_verification_service.py` (+ graph verify⇄debug⇄escalate)

**M8 — Reviewer**
- `agents/reviewer.py` (+ review node, README generation)
- *Note: a VCS port + git audit trail shipped in M8 and was fully removed later by decision — no trace remains.*

**M9 — Evals + hardening**
- `tests/evals/test_golden_prompts.py`, `tests/unit/agents/test_planner_retry.py` (+ budget checkpoints in graph, planner retry)

**M10 — FastAPI control plane**
- `interfaces/api/{app,run_manager}.py`, `tests/integration/test_api.py`

---

## 5. Milestone Evolution

- **M0** — Professional workshop: monorepo split, strict tooling (ruff, mypy strict, pytest), CI gates from the first commit.
- **M1** — The rulebook: four immutable, validated domain models encoding every business rule the engine would later obey.
- **M2** — First contact with the outside world: one typed LLM contract, one real adapter (with self-correcting parse-retry), one fake for free deterministic tests.
- **M3** — Nervous system: every significant action becomes an immutable event fanned out to pluggable sinks (console, trace file — later WebSocket).
- **M4** — The engine exists: LangGraph slice with checkpointing, human interrupt, and a CLI — kill it mid-run and resume from disk.
- **M5** — Hands, jailed: file writes and command execution locked to per-run workspaces; escape attempts proven blocked by attack tests.
- **M6** — The platform builds: coder agent turns each planned task into real files, in dependency order, with cross-task context.
- **M7** — The flagship: generated code is executed and verified; failures are diagnosed and patched by a debugger agent, bounded by retry limits, escalated to humans on exhaustion.
- **M8** — The SDLC completes: a reviewer agent judges the whole project and writes its README. (Its git audit trail was later removed by decision.)
- **M9** — Proof and discipline: budget kill-switch wired into the loop, planner self-corrects invalid DAGs, golden-prompt evals assert real-world outcomes.
- **M10** — Script becomes platform: FastAPI + WebSocket control plane runs the same engine in background tasks — the frontend contract, honored.

---

## 6. Summary

| Metric | Value |
|---|---|
| Important source files | 33 (excl. `__init__.py` markers) |
| Test files | 16 (121 test functions; 116 pass offline, 1 opt-in eval) |
| Modules (top-level packages) | 6 — domain, application, agents, orchestration, infrastructure, interfaces |
| Milestones completed | 11 (M0–M10) |
| Biggest architectural components | LangGraph orchestration (`graph.py`), domain model suite, sandbox jail, LLM adapter stack, RunManager/API |
| External integrations | OpenRouter (LLM), SQLite (checkpoints), subprocess (execution) |

**Architecture maturity: MVP → early Production-ready Platform.**
Rationale: full SDLC works end-to-end with self-healing, human gates,
resumability, cost control, and two interfaces over one engine; quality
gates (mypy strict, 116 offline tests, attack tests, eval harness) are
production-grade. Gaps that keep it short of "production-ready" without
qualification: generated code executes in the orchestrator's own Python
environment (Docker isolation pending), no auth/multi-user story on the
API, single-process run registry (in-memory), and evals not yet run at
scale to publish reliability numbers.
