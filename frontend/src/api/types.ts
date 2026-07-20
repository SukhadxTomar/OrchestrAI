/**
 * TypeScript mirrors of the backend contract.
 *
 * These shapes track backend/src/orchestrai exactly:
 *   - domain/events.py        → DomainEvent union
 *   - orchestration/state.py  → GraphState / RunStatus
 *   - interfaces/api/app.py   → RunSummary, request bodies
 *
 * The frontend NEVER imports backend code — this file is the contract.
 */

// ── Run lifecycle ──────────────────────────────────────────────────────────

export type RunPhase = "running" | "waiting_for_approval" | "finished" | "failed" | "cancelled";

export type RunStatus =
  | "analyzing"
  | "awaiting_approval"
  | "planning"
  | "awaiting_plan_approval"
  | "executing"
  | "executed"
  | "reviewed"
  | "rejected"
  | "aborted"
  | "halted";

export type TaskStatus = "pending" | "in_progress" | "verified" | "failed" | "escalated";

export interface Task {
  id: string;
  description: string;
  depends_on: string[];
  status: TaskStatus;
  attempts: number;
  max_attempts: number;
}

export interface ResolvedAmbiguity {
  kind: "resolved";
  question: string;
  chosen_default: string;
  rationale: string;
}

export interface OpenAmbiguity {
  kind: "open";
  question: string;
  options: string[];
}

export interface RequirementSpec {
  summary: string;
  functional_requirements: string[];
  constraints: string[];
  tech_stack: string[];
  ambiguities: (ResolvedAmbiguity | OpenAmbiguity)[];
}

export interface ReviewFinding {
  file: string;
  issue: string;
}

export interface ReviewReport {
  verdict: "approve" | "approve_with_findings";
  findings: ReviewFinding[];
  readme_markdown: string;
}

export interface RunSummary {
  run_id: string;
  phase: RunPhase;
  status: RunStatus | null;
  interrupt: InterruptPayload | null;
  total_cost_usd: string | null;
  artifacts: string[];
  review_verdict: string | null;
  error: string | null;
}

/** Payload of a LangGraph interrupt() at either approval gate. */
export interface InterruptPayload {
  question: string;
  spec?: RequirementSpec;
  open_questions?: string[];
  tasks?: { id: string; description: string; depends_on: string[] }[];
  task_id?: string; // escalation gate
  [key: string]: unknown;
}

export type ApprovalDecision = "approve" | "reject" | "skip" | "abort";

// ── Domain events (WS stream) ──────────────────────────────────────────────

interface EventBase {
  occurred_at: string; // ISO timestamp
}

export interface LLMCallCompleted extends EventBase {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: string;
  duration_ms: number;
}

export interface FileWritten extends EventBase {
  path: string;
  size_bytes: number;
}

export interface CommandExecuted extends EventBase {
  command: string[];
  exit_code: number;
  duration_ms: number;
  timed_out: boolean;
}

export interface TaskVerified extends EventBase {
  task_id: string;
  attempts: number;
}

export interface TaskFailed extends EventBase {
  task_id: string;
  attempt: number;
  summary: string;
}

export interface TaskEscalated extends EventBase {
  task_id: string;
}

export type WireEvent =
  | { event: "LLMCallCompleted"; data: LLMCallCompleted }
  | { event: "FileWritten"; data: FileWritten }
  | { event: "CommandExecuted"; data: CommandExecuted }
  | { event: "TaskVerified"; data: TaskVerified }
  | { event: "TaskFailed"; data: TaskFailed }
  | { event: "TaskEscalated"; data: TaskEscalated };

export type WireEventName = WireEvent["event"];

// ── Frontend-only enrichments ──────────────────────────────────────────────

/** The nine visual pipeline stages the UI narrates a run through. */
export type StageId =
  | "analyze"
  | "plan"
  | "architecture"
  | "generate"
  | "test"
  | "debug"
  | "review"
  | "document"
  | "complete";

export type StageState = "idle" | "active" | "done" | "failed" | "waiting";

export const STAGES: { id: StageId; label: string; blurb: string }[] = [
  { id: "analyze", label: "Analyze", blurb: "Reading intent, extracting requirements" },
  { id: "plan", label: "Plan", blurb: "Decomposing into a task DAG" },
  { id: "architecture", label: "Architecture", blurb: "Shaping modules and boundaries" },
  { id: "generate", label: "Generate", blurb: "Writing production code" },
  { id: "test", label: "Test", blurb: "Verifying every artifact" },
  { id: "debug", label: "Debug", blurb: "Self-healing failed checks" },
  { id: "review", label: "Review", blurb: "Principal-engineer final pass" },
  { id: "document", label: "Document", blurb: "Writing the README" },
  { id: "complete", label: "Complete", blurb: "Shippable" },
];

/** A single line in the reasoning timeline / terminal. */
export interface FeedItem {
  id: number;
  at: string;
  kind:
    | "thought"
    | "llm"
    | "file"
    | "command"
    | "verify-pass"
    | "verify-fail"
    | "escalate"
    | "gate"
    | "system";
  text: string;
  detail?: string;
}
