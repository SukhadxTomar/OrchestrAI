# OrchestrAI — Frontend

Placeholder for a future frontend. **Framework-agnostic by design** — React, Next.js,
Vue, Svelte, or anything else can live here.

## Contract with the backend

The frontend never imports backend code. It communicates exclusively through the
backend's HTTP/WebSocket API (FastAPI control plane, roadmap milestone M10):

- `POST /runs` — start a run from a natural-language prompt
- `GET /runs/{id}` — run status and results
- `WS  /runs/{id}/events` — live agent event stream
- `POST /runs/{id}/approvals` — answer human-in-the-loop interrupts

Until M10, the backend is driven by its CLI (`backend/src/orchestrai/interfaces/cli`).
