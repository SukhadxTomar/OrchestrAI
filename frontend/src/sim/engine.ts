/**
 * SimulationEngine — a faithful, prompt-aware replica of the backend run loop.
 *
 * Speaks the exact same event grammar as the FastAPI control plane
 * (LLMCallCompleted, FileWritten, CommandExecuted, TaskVerified/Failed) and
 * drives the same store, so the execution screen cannot tell the difference.
 * This is what makes the product fully demoable with the backend offline.
 *
 * The narrative follows the real LangGraph:
 *   analyze → spec gate → plan → plan gate → (code → verify → debug?)* → review
 * including one scripted verification failure so the self-healing loop shows.
 */
import type {
  ApprovalDecision,
  RequirementSpec,
  ReviewReport,
  StageId,
  Task,
} from "@/api/types";
import { languageFor, useRunStore } from "@/stores/runStore";
import { buildProject, type GeneratedProject } from "./projects";

const S = () => useRunStore.getState();

/** Cancellable, pause-aware sleep. */
class Clock {
  cancelled = false;
  private waiters: (() => void)[] = [];

  async sleep(ms: number) {
    const step = 50;
    let elapsed = 0;
    while (elapsed < ms) {
      if (this.cancelled) throw new CancelledError();
      if (!S().paused) elapsed += step;
      await new Promise((r) => setTimeout(r, step));
    }
  }

  /** Block until an approval decision arrives (or cancel). */
  waitForDecision(): Promise<ApprovalDecision> {
    return new Promise((resolve, reject) => {
      pendingResolver = (d) => resolve(d);
      this.waiters.push(() => reject(new CancelledError()));
    });
  }

  cancel() {
    this.cancelled = true;
    this.waiters.forEach((w) => w());
    this.waiters = [];
  }
}

class CancelledError extends Error {
  constructor() {
    super("run cancelled");
  }
}

let activeClock: Clock | null = null;
let pendingResolver: ((d: ApprovalDecision) => void) | null = null;

export function cancelSimulation() {
  activeClock?.cancel();
}

export function decideSimulation(decision: ApprovalDecision) {
  const r = pendingResolver;
  pendingResolver = null;
  r?.(decision);
}

// ── event emitters (mirror the backend wire format) ────────────────────────

function emitLLM(model: string, promptTok: number, compTok: number, ms: number) {
  const cost = (promptTok * 0.000003 + compTok * 0.000015).toFixed(6);
  S().ingestWire({
    event: "LLMCallCompleted",
    data: {
      occurred_at: new Date().toISOString(),
      model,
      prompt_tokens: promptTok,
      completion_tokens: compTok,
      cost_usd: cost,
      duration_ms: ms,
    },
  });
}

function emitFile(path: string, sizeBytes: number) {
  S().ingestWire({
    event: "FileWritten",
    data: { occurred_at: new Date().toISOString(), path, size_bytes: sizeBytes },
  });
}

function emitCommand(command: string[], exitCode: number, ms: number) {
  S().ingestWire({
    event: "CommandExecuted",
    data: {
      occurred_at: new Date().toISOString(),
      command,
      exit_code: exitCode,
      duration_ms: ms,
      timed_out: false,
    },
  });
}

// ── helpers ────────────────────────────────────────────────────────────────

function thought(text: string, detail?: string) {
  S().pushFeed({ kind: "thought", text, detail });
}

function term(text: string) {
  S().pushTerminal(text);
}

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo));

/** Stream a file into the store chunk by chunk so code "types itself". */
async function streamFile(clock: Clock, path: string, content: string, taskId?: string) {
  const chunks = Math.max(3, Math.min(9, Math.ceil(content.length / 400)));
  const per = Math.ceil(content.length / chunks);
  for (let i = 1; i <= chunks; i++) {
    await clock.sleep(rand(90, 220));
    S().addFile({
      path,
      content: content.slice(0, per * i),
      language: languageFor(path),
      taskId,
    });
  }
  emitFile(path, content.length);
}

// ── the run script ─────────────────────────────────────────────────────────

export async function runSimulation(runId: string, prompt: string): Promise<void> {
  const clock = new Clock();
  activeClock = clock;
  const store = S();
  store.begin(runId, prompt, "sim");

  const project: GeneratedProject = buildProject(prompt);

  try {
    // ── ANALYZE ───────────────────────────────────────────────────────────
    stage("analyze", "active");
    S().setStatus("analyzing");
    term(`\x1b[1m\x1b[38;5;141m◆ OrchestrAI\x1b[0m run \x1b[2m${runId}\x1b[0m`);
    term(`\x1b[2m${new Date().toLocaleTimeString()}\x1b[0m starting analysis…`);
    thought("Reading the prompt", `"${prompt.slice(0, 90)}${prompt.length > 90 ? "…" : ""}"`);
    await clock.sleep(1100);
    thought("Extracting functional requirements…");
    await clock.sleep(1400);
    thought("Scanning for ambiguities", "choosing sensible defaults where safe");
    await clock.sleep(1200);
    emitLLM("anthropic/claude-sonnet-5", rand(900, 1400), rand(600, 900), rand(2600, 4100));
    S().setSpec(project.spec);
    stage("analyze", "done");

    // ── SPEC GATE ─────────────────────────────────────────────────────────
    S().setStatus("awaiting_approval");
    S().setPhase("waiting_for_approval");
    S().setInterrupt({
      question: "Approve this requirement spec?",
      spec: project.spec,
      open_questions: project.spec.ambiguities
        .filter((a) => a.kind === "open")
        .map((a) => a.question),
    });
    S().pushFeed({ kind: "gate", text: "Awaiting spec approval", detail: "human-in-the-loop gate" });
    const specDecision = await clock.waitForDecision();
    S().setInterrupt(null);
    S().setPhase("running");
    if (specDecision !== "approve") {
      S().setStatus("rejected");
      term(`\x1b[31m✗\x1b[0m spec rejected — run stopped`);
      S().finish();
      return;
    }
    thought("Spec approved — moving to planning");

    // ── PLAN ──────────────────────────────────────────────────────────────
    stage("plan", "active");
    S().setStatus("planning");
    thought("Decomposing the spec into tasks…");
    await clock.sleep(1600);
    thought("Ordering by dependency", "validating the DAG is acyclic");
    await clock.sleep(1300);
    emitLLM("anthropic/claude-sonnet-5", rand(1400, 2100), rand(700, 1100), rand(3000, 4600));
    S().setTasks(project.tasks.map((t) => ({ ...t })));
    stage("plan", "done");

    // Architecture is the plan's visual identity forming — brief, cinematic.
    stage("architecture", "active");
    thought("Shaping module boundaries", `${project.tasks.length} tasks · ${project.files.length} files planned`);
    await clock.sleep(1800);
    stage("architecture", "done");

    // ── PLAN GATE ─────────────────────────────────────────────────────────
    S().setStatus("awaiting_plan_approval");
    S().setPhase("waiting_for_approval");
    S().setInterrupt({
      question: "Approve this task plan and start building?",
      tasks: project.tasks.map((t) => ({
        id: t.id,
        description: t.description,
        depends_on: t.depends_on,
      })),
    });
    S().pushFeed({ kind: "gate", text: "Awaiting plan approval", detail: "coding is where the money goes" });
    const planDecision = await clock.waitForDecision();
    S().setInterrupt(null);
    S().setPhase("running");
    if (planDecision !== "approve") {
      S().setStatus("rejected");
      term(`\x1b[31m✗\x1b[0m plan rejected — run stopped`);
      S().finish();
      return;
    }

    // ── EXECUTE: code → verify (→ debug) per task ─────────────────────────
    S().setStatus("executing");
    stage("generate", "active");
    let injectedFailure = false;

    for (const task of project.tasks) {
      if (clock.cancelled) throw new CancelledError();
      S().patchTask(task.id, { status: "in_progress", attempts: 1 });
      S().setActiveStage("generate");
      stage("generate", "active");
      thought(`Task ${task.id}: ${task.description}`);
      term(`\x1b[38;5;75m▸\x1b[0m task \x1b[1m${task.id}\x1b[0m — ${task.description}`);
      await clock.sleep(rand(700, 1200));

      const files = project.files.filter((f) => f.taskId === task.id);
      for (const f of files) {
        await streamFile(clock, f.path, f.content, task.id);
      }
      emitLLM("anthropic/claude-sonnet-5", rand(2000, 3600), rand(1200, 2400), rand(4200, 7800));

      // verify
      stage("generate", "done");
      stage("test", "active");
      S().setActiveStage("test");
      await clock.sleep(rand(500, 900));
      emitCommand(["python", "-m", "compileall", "-q", "."], 0, rand(300, 700));
      await clock.sleep(rand(400, 800));

      // One scripted failure mid-run → the self-healing loop gets its moment.
      const shouldFail = !injectedFailure && task.id === project.failingTaskId;
      if (shouldFail) {
        injectedFailure = true;
        emitCommand(["pytest", "-q"], 1, rand(1800, 2600));
        S().ingestWire({
          event: "TaskFailed",
          data: {
            occurred_at: new Date().toISOString(),
            task_id: task.id,
            attempt: 1,
            summary: project.failureSummary,
          },
        });
        stage("test", "failed");

        // debug
        stage("debug", "active");
        S().setActiveStage("debug");
        thought("Reading the failure…", project.failureSummary);
        await clock.sleep(1600);
        thought("Locating the defect", "diffing expectation vs behavior");
        await clock.sleep(1500);
        emitLLM("anthropic/claude-sonnet-5", rand(1800, 2600), rand(600, 1000), rand(3200, 5400));
        const fix = project.files.find((f) => f.taskId === task.id);
        if (fix) {
          thought(`Patching ${fix.path}`);
          await streamFile(clock, fix.path, fix.content, task.id);
        }
        S().patchTask(task.id, { status: "in_progress", attempts: 2 });
        stage("debug", "done");

        // re-verify
        stage("test", "active");
        S().setActiveStage("test");
        await clock.sleep(rand(600, 1000));
        emitCommand(["pytest", "-q"], 0, rand(1600, 2400));
        S().ingestWire({
          event: "TaskVerified",
          data: { occurred_at: new Date().toISOString(), task_id: task.id, attempts: 2 },
        });
      } else {
        emitCommand(["pytest", "-q"], 0, rand(1200, 2200));
        S().ingestWire({
          event: "TaskVerified",
          data: { occurred_at: new Date().toISOString(), task_id: task.id, attempts: 1 },
        });
      }
      stage("test", "done");
    }
    S().setStatus("executed");

    // ── REVIEW ────────────────────────────────────────────────────────────
    stage("review", "active");
    S().setActiveStage("review");
    thought("Final review", "reading every generated file as a principal engineer");
    await clock.sleep(2400);
    emitLLM("anthropic/claude-sonnet-5", rand(4200, 6800), rand(1000, 1600), rand(5200, 8600));
    S().setReview(project.review);
    stage("review", "done");

    // ── DOCUMENT ──────────────────────────────────────────────────────────
    stage("document", "active");
    S().setActiveStage("document");
    thought("Writing README.md");
    await streamFile(clock, "README.md", project.review.readme_markdown);
    stage("document", "done");

    // ── COMPLETE ──────────────────────────────────────────────────────────
    stage("complete", "done");
    S().setActiveStage(null);
    S().setStatus("reviewed");
    term(`\x1b[32m\x1b[1m✓ run complete\x1b[0m — ${S().files.length} files · $${S().metrics.costUsd.toFixed(4)}`);
    S().finish();
  } catch (err) {
    if (err instanceof CancelledError) {
      S().setStatus("aborted");
      S().pushTerminal(`\x1b[33m■ run cancelled by user\x1b[0m`);
      S().finish();
    } else {
      S().fail(err instanceof Error ? err.message : String(err));
    }
  } finally {
    if (activeClock === clock) activeClock = null;
  }
}

function stage(id: StageId, state: "active" | "done" | "failed") {
  S().setStage(id, state);
  if (state === "active") S().setActiveStage(id);
}

export type { Task, RequirementSpec, ReviewReport };
