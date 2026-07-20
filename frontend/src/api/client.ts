import type { ApprovalDecision, RunSummary, WireEvent } from "./types";

/**
 * REST + WebSocket client for the FastAPI control plane.
 * All paths go through the Vite dev proxy (/api → :8000).
 * Every call fails fast so the app can fall back to simulation mode.
 */

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
  return res.json() as Promise<T>;
}

export function startRun(prompt: string, budgetUsd = 5): Promise<RunSummary> {
  return request<RunSummary>("/runs", {
    method: "POST",
    body: JSON.stringify({ prompt, budget_usd: budgetUsd }),
  });
}

export function getRun(runId: string): Promise<RunSummary> {
  return request<RunSummary>(`/runs/${runId}`);
}

export function sendApproval(runId: string, decision: ApprovalDecision): Promise<RunSummary> {
  return request<RunSummary>(`/runs/${runId}/approvals`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

/** Fetch one generated file's content from the run workspace (live mode). */
export function getRunFile(runId: string, path: string): Promise<{ path: string; content: string }> {
  return request<{ path: string; content: string }>(
    `/runs/${runId}/files/${path.split(/[\\/]/).map(encodeURIComponent).join("/")}`,
  );
}

/** Cancel a running execution on the backend. */
export function cancelRunApi(runId: string): Promise<RunSummary> {
  return request<RunSummary>(`/runs/${runId}`, { method: "DELETE" });
}

/** Probe: is a real backend alive? Resolves fast either way. */
export async function backendAlive(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    // Any HTTP response (even 404) proves uvicorn is there.
    await fetch(`${BASE}/runs/__probe__`, { signal: ctrl.signal });
    clearTimeout(t);
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to a run's live event stream with automatic reconnect.
 * Returns an unsubscribe function.
 */
export function subscribeEvents(
  runId: string,
  onEvent: (event: WireEvent) => void,
  onStatusChange?: (connected: boolean) => void,
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let retryMs = 500;

  const connect = () => {
    if (closed) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/api-ws/runs/${runId}/events`);
    ws.onopen = () => {
      retryMs = 500;
      onStatusChange?.(true);
    };
    ws.onmessage = (msg) => {
      try {
        onEvent(JSON.parse(msg.data) as WireEvent);
      } catch {
        /* malformed frame — ignore */
      }
    };
    ws.onclose = () => {
      onStatusChange?.(false);
      if (!closed) {
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 8000);
      }
    };
  };

  connect();
  return () => {
    closed = true;
    ws?.close();
  };
}
