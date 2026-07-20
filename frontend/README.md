# OrchestrAI — Frontend

The OrchestrAI console: a React app where one prompt becomes a watchable,
approvable, self-healing software build.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Works out of the box with **no backend** — a built-in simulation engine speaks
the exact backend event grammar, so every screen (pipeline, reasoning feed,
terminal, code viewer, approval gates) is fully live.

With the backend running (`uv run uvicorn orchestrai.interfaces.api.app:create_app
--factory --reload` on :8000), the app auto-detects it and switches to live mode:
`POST /runs`, `GET /runs/{id}`, `POST /runs/{id}/approvals`, and the
`WS /runs/{id}/events` stream, proxied through Vite (`/api`, `/api-ws`).
The frontend never imports backend code — `src/api/types.ts` is the contract.

## Map

```
src/
├── api/            contract types, REST/WS client, run controller (live vs sim)
├── sim/            simulation engine + prompt-aware project synthesis
├── stores/         zustand run store — single source of truth for a run
├── lib/            motion language, utilities
├── components/
│   ├── ui/         design-system primitives (Button, Card, Dialog, Toast, …)
│   ├── background/ aurora mesh, particles, cursor glow, noise
│   ├── system/     Logo, PromptComposer, CommandPalette (⌘K)
│   ├── pipeline/   the nine-stage pipeline rail
│   └── execution/  Mission Control panels (terminal, Monaco, feed, gates)
└── pages/          Landing (/), Dashboard (/app), Execution (/runs/:id)
```

## Scripts

- `npm run dev` — dev server with backend proxy
- `npm run build` — typecheck + production build
- `npm run preview` — serve the production build
