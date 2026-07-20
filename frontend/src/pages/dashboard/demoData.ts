/** Rich but honest demo data for the dashboard (clearly-labeled sample workspace). */

export interface ProjectCard {
  id: string;
  name: string;
  prompt: string;
  status: "reviewed" | "executing" | "halted" | "failed";
  files: number;
  costUsd: number;
  updatedAt: string;
  pinned?: boolean;
  stack: string[];
}

const h = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString();

export const PROJECTS: ProjectCard[] = [
  {
    id: "run-9f2ac1",
    name: "Nimbus SaaS",
    prompt: "Build me a SaaS for team invoicing with JWT auth",
    status: "reviewed",
    files: 14,
    costUsd: 1.8421,
    updatedAt: h(2),
    pinned: true,
    stack: ["FastAPI", "SQLAlchemy", "pytest"],
  },
  {
    id: "run-b81e77",
    name: "Relay Chat",
    prompt: "Build a real-time chat service with rooms and presence",
    status: "executing",
    files: 9,
    costUsd: 0.9313,
    updatedAt: h(0.4),
    pinned: true,
    stack: ["FastAPI", "WebSockets", "Redis"],
  },
  {
    id: "run-c4d902",
    name: "Linklet",
    prompt: "Build a URL shortener with click analytics",
    status: "reviewed",
    files: 8,
    costUsd: 0.6702,
    updatedAt: h(26),
    stack: ["FastAPI", "SQLite"],
  },
  {
    id: "run-77aa03",
    name: "Inkwell CMS",
    prompt: "Build a headless CMS with markdown storage",
    status: "halted",
    files: 5,
    costUsd: 2.0,
    updatedAt: h(50),
    stack: ["FastAPI", "S3"],
  },
  {
    id: "run-e19c44",
    name: "Cartesian",
    prompt: "Build an e-commerce cart service with inventory holds",
    status: "failed",
    files: 3,
    costUsd: 0.4118,
    updatedAt: h(74),
    stack: ["FastAPI", "Postgres"],
  },
  {
    id: "run-a3f8b2",
    name: "TaskForge",
    prompt: "Build a task management API with team workspaces",
    status: "reviewed",
    files: 12,
    costUsd: 1.2245,
    updatedAt: h(120),
    stack: ["FastAPI", "SQLAlchemy"],
  },
];

export interface ActivityItem {
  id: string;
  at: string;
  kind: "verified" | "failed" | "escalated" | "reviewed" | "started" | "gate";
  text: string;
  run: string;
}

export const ACTIVITY: ActivityItem[] = [
  { id: "a1", at: h(0.2), kind: "verified", text: "t3 auth layer verified (attempt 1)", run: "Relay Chat" },
  { id: "a2", at: h(0.5), kind: "gate", text: "Plan approved — 6 tasks queued", run: "Relay Chat" },
  { id: "a3", at: h(2), kind: "reviewed", text: "Final review: approve_with_findings (2 findings)", run: "Nimbus SaaS" },
  { id: "a4", at: h(2.4), kind: "failed", text: "t4 failed pytest — routed to Debugger", run: "Nimbus SaaS" },
  { id: "a5", at: h(3.1), kind: "verified", text: "t4 verified after self-heal (attempt 2)", run: "Nimbus SaaS" },
  { id: "a6", at: h(26), kind: "reviewed", text: "Final review: approve", run: "Linklet" },
  { id: "a7", at: h(49), kind: "escalated", text: "t5 escalated — S3 credentials required", run: "Inkwell CMS" },
  { id: "a8", at: h(50), kind: "started", text: "Run started · budget $2.00", run: "Inkwell CMS" },
];

/** Cost by day for the spend chart (last 14 days). */
export const SPEND: { day: string; usd: number }[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.now() - (13 - i) * 86400_000);
  const base = [0.4, 1.1, 0.7, 1.9, 2.6, 1.2, 0.5, 1.4, 3.1, 2.2, 1.7, 2.9, 1.1, 1.8][i];
  return { day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), usd: base };
});
