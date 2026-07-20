/**
 * Run controller — the one place that decides live vs simulation.
 *
 * `launchRun(prompt)` probes the FastAPI backend. If alive, it POSTs /runs
 * and wires the WebSocket into the store; otherwise it starts the local
 * SimulationEngine. Either way the execution page renders from the same
 * runStore and cannot tell the difference. Approvals and cancellation are
 * routed to whichever transport owns the run.
 *
 * The backend is never modified — this file only *talks* to it.
 */
import {
  backendAlive,
  cancelRunApi,
  getRun,
  getRunFile,
  sendApproval,
  startRun,
  subscribeEvents,
} from "@/api/client";
import type { ApprovalDecision, RunStatus, StageId } from "@/api/types";
import { cancelSimulation, decideSimulation, runSimulation } from "@/sim/engine";
import { languageFor, useRunStore } from "@/stores/runStore";

let unsubscribeWs: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const S = () => useRunStore.getState();

/** Map a backend RunStatus onto visual stage states (live mode). */
function syncStagesFromStatus(status: RunStatus) {
  const done = (ids: StageId[]) => ids.forEach((id) => S().setStage(id, "done"));
  switch (status) {
    case "analyzing":
      S().setStage("analyze", "active");
      S().setActiveStage("analyze");
      break;
    case "awaiting_approval":
      done(["analyze"]);
      S().setStage("plan", "waiting");
      break;
    case "planning":
      done(["analyze"]);
      S().setStage("plan", "active");
      S().setActiveStage("plan");
      break;
    case "awaiting_plan_approval":
      done(["analyze", "plan", "architecture"]);
      S().setStage("generate", "waiting");
      break;
    case "executing":
      done(["analyze", "plan", "architecture"]);
      S().setStage("generate", "active");
      S().setActiveStage("generate");
      break;
    case "executed":
      done(["analyze", "plan", "architecture", "generate", "test", "debug"]);
      S().setStage("review", "active");
      S().setActiveStage("review");
      break;
    case "reviewed":
      done([
        "analyze", "plan", "architecture", "generate",
        "test", "debug", "review", "document", "complete",
      ]);
      S().setActiveStage(null);
      break;
    case "rejected":
    case "aborted":
    case "halted":
      S().setActiveStage(null);
      break;
  }
}

export async function launchRun(prompt: string): Promise<string> {
  teardown();
  const live = await backendAlive();

  if (live) {
    try {
      const summary = await startRun(prompt);
      const runId = summary.run_id;
      S().begin(runId, prompt, "live");
      S().pushFeed({ kind: "system", text: "Connected to OrchestrAI control plane" });
      attachLive(runId);
      return runId;
    } catch {
      // Backend answered the probe but rejected the run — fall through to sim.
    }
  }

  const runId = `sim-${Math.random().toString(36).slice(2, 10)}`;
  void runSimulation(runId, prompt);
  return runId;
}

/** Fetch a generated file into the store (idempotent by path+content). */
function pullFile(runId: string, rawPath: string) {
  const path = rawPath.replace(/\\/g, "/");
  void getRunFile(runId, path)
    .then((file) =>
      S().addFile({ path, content: file.content, language: languageFor(path) }),
    )
    .catch(() => {
      /* transient (file mid-write / server busy) — the poll reconciler retries */
    });
}

function attachLive(runId: string) {
  // The queue sink replays FULL history on every (re)connect. Track how many
  // events we've already processed so replays never double-count metrics.
  let processed = 0;
  let index = 0;

  unsubscribeWs = subscribeEvents(
    runId,
    (event) => {
      index += 1;
      if (index <= processed) return; // replayed history — already ingested
      processed = index;
      S().ingestWire(event);
      // The wire only says "a file was written" — pull its content so the
      // Code tab and Preview show real files, exactly like simulation mode.
      if (event.event === "FileWritten") pullFile(runId, event.data.path);
    },
    (connected) => {
      if (connected) index = 0; // new connection ⇒ history replays from zero
      S().setWsConnected(connected);
    },
  );

  // Poll the snapshot for phase/status/interrupt (the WS only carries events).
  pollTimer = setInterval(async () => {
    try {
      const run = await getRun(runId);
      S().setPhase(run.phase);
      if (run.status) {
        S().setStatus(run.status);
        syncStagesFromStatus(run.status);
      }
      S().setInterrupt(run.interrupt);
      if (run.interrupt?.spec) S().setSpec(run.interrupt.spec);
      if (run.interrupt?.tasks) {
        S().setTasks(
          run.interrupt.tasks.map((t) => ({
            ...t,
            status: "pending" as const,
            attempts: 0,
            max_attempts: 3,
          })),
        );
      }
      // Reconciler: any artifact the store is missing (WS hiccup, failed
      // fetch, late join) gets pulled here — files can never stay absent.
      if (run.artifacts.length > 0) {
        const have = new Set(useRunStore.getState().files.map((f) => f.path));
        for (const artifact of run.artifacts) {
          if (!have.has(artifact.replace(/\\/g, "/"))) pullFile(runId, artifact);
        }
      }
      if (run.error) S().fail(run.error);
      if (run.phase === "finished") {
        S().finish();
        teardown();
      }
      if (run.phase === "cancelled") {
        S().setPhase("cancelled");
        teardown();
      }
    } catch {
      /* transient — keep polling */
    }
  }, 1500);
}

export async function decideGate(decision: ApprovalDecision): Promise<void> {
  const { mode, runId } = S();
  if (mode === "live" && runId) {
    await sendApproval(runId, decision);
    S().setInterrupt(null);
    S().setPhase("running");
  } else {
    decideSimulation(decision);
  }
}

export function pauseRun() {
  if (S().mode === "sim") S().setPaused(true);
}

export function resumeRun() {
  if (S().mode === "sim") S().setPaused(false);
}

export function cancelRun() {
  const { mode, runId } = S();
  if (mode === "sim") {
    cancelSimulation();
  } else if (mode === "live" && runId) {
    // Fire the DELETE and reflect the outcome; optimistically stop streaming
    // immediately so the UI goes quiet the instant the user clicks.
    void cancelRunApi(runId)
      .then(() => {
        S().setPhase("cancelled");
        S().setStatus("aborted");
        S().setActivity(null);
        S().pushTerminal("\x1b[33m■ run cancelled by user\x1b[0m");
        S().pushFeed({ kind: "system", text: "Run cancelled — nothing further will be spent" });
      })
      .catch(() => {
        /* run may already be finished; the poller has the final word */
      });
  }
  teardown();
}

export function retryRun(): Promise<string> {
  const prompt = S().prompt;
  return launchRun(prompt);
}

function teardown() {
  unsubscribeWs?.();
  unsubscribeWs = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
