/**
 * Central run store — the single source of truth an execution screen renders.
 *
 * Both transports feed it:
 *   • live mode — REST snapshots + WebSocket DomainEvents from FastAPI
 *   • simulation mode — the local SimulationEngine (same event grammar)
 *
 * The store translates low-level events into the visual narrative:
 * stage states, the reasoning feed, terminal lines, the virtual file tree.
 */
import { create } from "zustand";
import type {
  FeedItem,
  InterruptPayload,
  RequirementSpec,
  ReviewReport,
  RunPhase,
  RunStatus,
  StageId,
  StageState,
  Task,
  WireEvent,
} from "@/api/types";

export interface VirtualFile {
  path: string;
  content: string;
  language: string;
  taskId?: string;
  writtenAt: number; // seq for "appearing in real time" animations
}

export interface RunMetrics {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  llmCalls: number;
  llmMs: number; // cumulative model time
  commands: number;
  filesWritten: number;
  startedAt: number | null;
  endedAt: number | null;
}

export interface TerminalLine {
  id: number;
  text: string; // may contain ANSI escapes
}

interface RunState {
  runId: string | null;
  mode: "sim" | "live" | null;
  prompt: string;
  phase: RunPhase;
  status: RunStatus | null;
  paused: boolean;
  stages: Record<StageId, StageState>;
  activeStage: StageId | null;
  feed: FeedItem[];
  terminal: TerminalLine[];
  files: VirtualFile[];
  tasks: Task[];
  spec: RequirementSpec | null;
  review: ReviewReport | null;
  interrupt: InterruptPayload | null;
  metrics: RunMetrics;
  wsConnected: boolean;
  error: string | null;
  /** One-line "what's happening right now" for the buffering ticker. */
  activity: string | null;
}

interface RunActions {
  begin(runId: string, prompt: string, mode: "sim" | "live"): void;
  setPhase(phase: RunPhase): void;
  setStatus(status: RunStatus): void;
  setPaused(paused: boolean): void;
  setStage(stage: StageId, state: StageState): void;
  setActiveStage(stage: StageId | null): void;
  pushFeed(item: Omit<FeedItem, "id" | "at">): void;
  pushTerminal(text: string): void;
  addFile(file: Omit<VirtualFile, "writtenAt">): void;
  setTasks(tasks: Task[]): void;
  patchTask(id: string, patch: Partial<Task>): void;
  setSpec(spec: RequirementSpec): void;
  setReview(review: ReviewReport): void;
  setInterrupt(payload: InterruptPayload | null): void;
  setActivity(activity: string | null): void;
  ingestWire(event: WireEvent): void;
  setWsConnected(connected: boolean): void;
  fail(error: string): void;
  finish(): void;
  reset(): void;
}

let feedSeq = 0;
let termSeq = 0;
let fileSeq = 0;

const emptyStages = (): Record<StageId, StageState> => ({
  analyze: "idle",
  plan: "idle",
  architecture: "idle",
  generate: "idle",
  test: "idle",
  debug: "idle",
  review: "idle",
  document: "idle",
  complete: "idle",
});

const emptyMetrics = (): RunMetrics => ({
  promptTokens: 0,
  completionTokens: 0,
  costUsd: 0,
  llmCalls: 0,
  llmMs: 0,
  commands: 0,
  filesWritten: 0,
  startedAt: null,
  endedAt: null,
});

const initial: RunState = {
  runId: null,
  mode: null,
  prompt: "",
  phase: "running",
  status: null,
  paused: false,
  stages: emptyStages(),
  activeStage: null,
  feed: [],
  terminal: [],
  files: [],
  tasks: [],
  spec: null,
  review: null,
  interrupt: null,
  metrics: emptyMetrics(),
  wsConnected: false,
  error: null,
  activity: null,
};

export function languageFor(path: string): string {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    py: "python", ts: "typescript", tsx: "typescript", js: "javascript",
    json: "json", md: "markdown", html: "html", css: "css", yml: "yaml",
    yaml: "yaml", toml: "ini", sql: "sql", sh: "shell", txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

/** Friendly, non-technical narration for the feed. */
const CRAFT_PHRASES = [
  "Crafting",
  "Sculpting",
  "Bringing to life",
  "Carefully writing",
  "Polishing",
  "Weaving together",
  "Hand-building",
  "Shaping",
];
const THINK_PHRASES = [
  "Deep in thought",
  "Connecting the dots",
  "Weighing the options",
  "Sketching ideas",
  "Reasoning it through",
];
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const useRunStore = create<RunState & RunActions>((set, get) => ({
  ...initial,

  begin: (runId, prompt, mode) =>
    set({
      ...initial,
      runId,
      prompt,
      mode,
      stages: emptyStages(),
      metrics: { ...emptyMetrics(), startedAt: Date.now() },
    }),

  setPhase: (phase) => set({ phase }),
  setStatus: (status) => set({ status }),
  setPaused: (paused) => set({ paused }),

  setStage: (stage, state) =>
    set((s) => ({ stages: { ...s.stages, [stage]: state } })),

  setActiveStage: (activeStage) => set({ activeStage }),

  pushFeed: (item) =>
    set((s) => ({
      feed: [...s.feed, { ...item, id: ++feedSeq, at: new Date().toISOString() }],
    })),

  pushTerminal: (text) =>
    set((s) => ({ terminal: [...s.terminal, { id: ++termSeq, text }] })),

  addFile: (file) =>
    set((s) => {
      const existing = s.files.findIndex((f) => f.path === file.path);
      const entry: VirtualFile = { ...file, writtenAt: ++fileSeq };
      const files =
        existing >= 0
          ? s.files.map((f, i) => (i === existing ? entry : f))
          : [...s.files, entry];
      // Count unique files, not streamed chunks/re-writes.
      const filesWritten = existing >= 0 ? s.metrics.filesWritten : s.metrics.filesWritten + 1;
      return { files, metrics: { ...s.metrics, filesWritten } };
    }),

  setTasks: (tasks) => set({ tasks }),

  patchTask: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  setSpec: (spec) => set({ spec }),
  setReview: (review) => set({ review }),
  setInterrupt: (interrupt) => set({ interrupt }),
  setActivity: (activity) => set({ activity }),

  /** Translate a backend DomainEvent into feed/terminal/metrics updates. */
  ingestWire: (wire) => {
    const { pushFeed, pushTerminal, patchTask } = get();
    switch (wire.event) {
      case "LLMCallCompleted": {
        const d = wire.data;
        set((s) => ({
          metrics: {
            ...s.metrics,
            promptTokens: s.metrics.promptTokens + d.prompt_tokens,
            completionTokens: s.metrics.completionTokens + d.completion_tokens,
            costUsd: s.metrics.costUsd + Number(d.cost_usd),
            llmCalls: s.metrics.llmCalls + 1,
            llmMs: s.metrics.llmMs + d.duration_ms,
          },
          activity: pick(THINK_PHRASES) + "…",
        }));
        pushFeed({
          kind: "llm",
          text: `${pick(THINK_PHRASES)} — a burst of ideas just landed`,
          detail: `${((d.prompt_tokens + d.completion_tokens) / 1000).toFixed(1)}k thoughts · ${(d.duration_ms / 1000).toFixed(1)}s`,
        });
        break;
      }
      case "FileWritten": {
        const d = wire.data;
        const name = d.path.replace(/\\/g, "/").split("/").pop() ?? d.path;
        set({ activity: `${pick(CRAFT_PHRASES)} ${name}…` });
        pushFeed({
          kind: "file",
          text: `${pick(CRAFT_PHRASES)} ${name}`,
          detail: d.path.replace(/\\/g, "/"),
        });
        pushTerminal(`\x1b[38;5;141mwrite\x1b[0m ${d.path} \x1b[2m(${d.size_bytes} B)\x1b[0m`);
        break;
      }
      case "CommandExecuted": {
        const d = wire.data;
        const ok = d.exit_code === 0;
        set((s) => ({
          metrics: { ...s.metrics, commands: s.metrics.commands + 1 },
          activity: ok ? "Everything checks out ✓" : "Hmm, something's off — investigating…",
        }));
        pushTerminal(
          `\x1b[38;5;75m$\x1b[0m ${d.command.join(" ")}  ` +
            (ok
              ? `\x1b[32m✓ exit 0\x1b[0m`
              : `\x1b[31m✗ exit ${d.exit_code}${d.timed_out ? " (timeout)" : ""}\x1b[0m`) +
            ` \x1b[2m${d.duration_ms}ms\x1b[0m`,
        );
        pushFeed({
          kind: "command",
          text: ok ? "Ran a quality check — all clear" : "Quality check caught something",
          detail: ok ? `took ${(d.duration_ms / 1000).toFixed(1)}s` : "handing it to the debugger",
        });
        break;
      }
      case "TaskVerified": {
        const d = wire.data;
        patchTask(d.task_id, { status: "verified", attempts: d.attempts });
        set({ activity: "Milestone complete 🎉" });
        pushFeed({
          kind: "verify-pass",
          text:
            d.attempts > 1
              ? `Fixed it! ${d.task_id} now works perfectly`
              : `Nailed it — ${d.task_id} works on the first try`,
          detail: d.attempts > 1 ? `took ${d.attempts} tries, worth it` : undefined,
        });
        pushTerminal(`\x1b[32m✓\x1b[0m task \x1b[1m${d.task_id}\x1b[0m verified`);
        break;
      }
      case "TaskFailed": {
        const d = wire.data;
        patchTask(d.task_id, { status: "failed", attempts: d.attempt });
        set({ activity: "Rolling up sleeves — time to debug…" });
        pushFeed({
          kind: "verify-fail",
          text: `Hit a snag on ${d.task_id} — no worries, debugging now`,
          detail: d.summary,
        });
        pushTerminal(`\x1b[31m✗\x1b[0m task ${d.task_id} attempt ${d.attempt}: \x1b[2m${d.summary.slice(0, 120)}\x1b[0m`);
        break;
      }
      case "TaskEscalated": {
        const d = wire.data;
        patchTask(d.task_id, { status: "escalated" });
        set({ activity: "Need a human's wisdom on this one" });
        pushFeed({
          kind: "escalate",
          text: `${d.task_id} is trickier than expected — asking for your call`,
        });
        pushTerminal(`\x1b[33m⚠\x1b[0m task ${d.task_id} escalated`);
        break;
      }
    }
  },

  setWsConnected: (wsConnected) => set({ wsConnected }),

  fail: (error) =>
    set((s) => ({
      error,
      phase: "failed",
      metrics: { ...s.metrics, endedAt: Date.now() },
      activeStage: null,
      activity: null,
    })),

  finish: () =>
    set((s) => ({
      phase: "finished",
      metrics: { ...s.metrics, endedAt: Date.now() },
      activity: null,
    })),

  reset: () => set({ ...initial, stages: emptyStages(), metrics: emptyMetrics() }),
}));
