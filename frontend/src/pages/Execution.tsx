import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronDown,
  FileCode2,
  GitBranch,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Square,
  TerminalSquare,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/system/Logo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Tooltip } from "@/components/ui/Tooltip";
import { toast } from "@/components/ui/Toast";
import { PipelineRail } from "@/components/pipeline/PipelineRail";
import { ApprovalGate } from "@/components/execution/ApprovalGate";
import { ActivityTicker } from "@/components/execution/ActivityTicker";
import { CodeViewer } from "@/components/execution/CodeViewer";
import { LiveTerminal } from "@/components/execution/LiveTerminal";
import { MetricsBar } from "@/components/execution/MetricsBar";
import { PreviewPane } from "@/components/execution/PreviewPane";
import { ReasoningFeed } from "@/components/execution/ReasoningFeed";
import { TaskGraph } from "@/components/execution/TaskGraph";
import { cancelRun, launchRun, pauseRun, resumeRun, retryRun } from "@/api/runController";
import { useRunStore } from "@/stores/runStore";
import { STAGES } from "@/api/types";
import { pageVariants, rise, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

type PanelTab = "reasoning" | "code" | "preview" | "terminal" | "tasks";

/**
 * Execution — a landing-grade animated hero up top, and below it the whole
 * build running inside a macOS-style window ("the machine room").
 */
export default function Execution() {
  const { runId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const launched = useRef(false);

  const phase = useRunStore((s) => s.phase);
  const status = useRunStore((s) => s.status);
  const stages = useRunStore((s) => s.stages);
  const paused = useRunStore((s) => s.paused);
  const mode = useRunStore((s) => s.mode);
  const prompt = useRunStore((s) => s.prompt);
  const error = useRunStore((s) => s.error);
  const review = useRunStore((s) => s.review);

  const [tab, setTab] = useState<PanelTab>("reasoning");
  const workRef = useRef<HTMLDivElement>(null);

  // /runs/new?prompt=… → launch and swap the URL for the real id.
  useEffect(() => {
    if (launched.current) return;
    if (runId === "new") {
      const p = params.get("prompt") ?? "Build me a SaaS";
      launched.current = true;
      void launchRun(p).then((id) => navigate(`/runs/${id}`, { replace: true }));
    } else if (runId && useRunStore.getState().runId !== runId) {
      launched.current = true;
      void launchRun(params.get("prompt") ?? "Build me a SaaS").then((id) =>
        navigate(`/runs/${id}`, { replace: true }),
      );
    }
  }, [runId, params, navigate]);

  // Auto-jump to the code view the first time a file lands.
  const fileCount = useRunStore((s) => s.files.length);
  const htmlCount = useRunStore((s) => s.files.filter((f) => f.path.endsWith(".html")).length);
  const jumped = useRef(false);
  useEffect(() => {
    if (fileCount > 0 && !jumped.current) {
      jumped.current = true;
      setTab("code");
    }
  }, [fileCount]);

  // …and to the live preview the first time a runnable page appears.
  const previewJumped = useRef(false);
  useEffect(() => {
    if (htmlCount > 0 && !previewJumped.current) {
      previewJumped.current = true;
      setTab("preview");
    }
  }, [htmlCount]);

  const doneCount = STAGES.filter((s) => stages[s.id] === "done").length;
  const progress = doneCount / STAGES.length;
  const finished = phase === "finished";
  const failed = phase === "failed";
  const cancelled = phase === "cancelled";
  const settled = finished || failed || cancelled;

  // Hero parallax: drifts up and fades as you scroll to the machine room.
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 420], [0, 90]);
  const heroOpacity = useTransform(scrollY, [0, 380], [1, 0.15]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen"
    >
      <ApprovalGate />

      {/* ── Floating nav ───────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-40"
      >
        <div className="glass sheen mx-auto mt-4 flex max-w-6xl items-center gap-3 rounded-xl px-4 py-2.5">
          <Link
            to="/app"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-faint transition-colors hover:bg-white/[0.05] hover:text-fg"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Logo />
          <div className="ml-auto flex items-center gap-2">
            {mode === "sim" && <Badge tone="cyan">simulation</Badge>}
            {mode === "live" && (
              <Badge tone="ok" pulse>
                live backend
              </Badge>
            )}
            <ProgressRing
              value={progress}
              size={36}
              stroke={3}
              indeterminate={phase === "running" && progress === 0}
            >
              <span className="font-mono text-2xs text-fg-muted">{Math.round(progress * 100)}</span>
            </ProgressRing>
          </div>
        </div>
      </motion.header>

      {/* ── Hero (landing energy) ──────────────────────────────────── */}
      <motion.section
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative mx-auto flex min-h-[52vh] max-w-4xl flex-col items-center justify-center px-4 pb-10 pt-32 text-center"
      >
        <motion.div variants={stagger} initial="initial" animate="animate" className="contents">
          <motion.div variants={rise}>
            <Badge tone="accent" pulse className="mb-5">
              {phase === "running"
                ? "The team is on it"
                : finished
                  ? "Mission accomplished"
                  : cancelled
                    ? "Cancelled"
                    : failed
                      ? "Run stopped"
                      : "Warming up"}
            </Badge>
          </motion.div>

          <motion.h1
            variants={rise}
            className="text-xl font-semibold tracking-tight sm:text-2xl"
          >
            <span className="text-aurora">Watch it being built.</span>
          </motion.h1>

          <motion.p
            variants={rise}
            className="mx-auto mt-4 max-w-xl text-md leading-relaxed text-fg-muted"
          >
            “{prompt || "Preparing run…"}”
          </motion.p>

          <motion.div
            variants={rise}
            className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-fg-faint"
          >
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-ok" /> You approve every big step
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-warn" /> Fixes its own mistakes
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent-cyan" /> Every thought, live
            </span>
          </motion.div>

          {/* Horizontal pipeline — the hero's centerpiece */}
          <motion.div variants={rise} className="mt-8 w-full">
            <div className="glass sheen mx-auto max-w-fit rounded-xl px-3 py-2">
              <PipelineRail
                stages={stages}
                orientation="horizontal"
                className="no-scrollbar overflow-x-auto"
              />
            </div>
          </motion.div>

          <motion.button
            variants={rise}
            onClick={() => workRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="mt-10 flex flex-col items-center gap-1.5 text-fg-ghost transition-colors hover:text-fg-muted"
          >
            <span className="text-2xs uppercase tracking-[0.2em]">The machine room</span>
            <motion.span
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </motion.button>
        </motion.div>
      </motion.section>

      {/* ── The machine room: a macOS window ───────────────────────── */}
      <section ref={workRef} className="mx-auto max-w-[1400px] scroll-mt-6 px-3 pb-16 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
          className={cn(
            "glass-deep sheen overflow-hidden rounded-xl shadow-e3",
            phase === "running" && "shadow-glow",
          )}
        >
          {/* Title bar — Apple style */}
          <div className="relative flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="group flex items-center gap-2">
              <Tooltip label="Cancel run">
                <button
                  onClick={() => phase === "running" && cancelRun()}
                  disabled={phase !== "running"}
                  className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)] transition-transform hover:scale-110 disabled:opacity-40"
                  aria-label="Cancel run"
                >
                  <Square className="h-1.5 w-1.5 text-black/0 transition-colors group-hover:text-black/60" />
                </button>
              </Tooltip>
              <Tooltip label={paused ? "Resume" : "Pause"}>
                <button
                  onClick={() => {
                    if (phase !== "running" || mode !== "sim") return;
                    paused ? resumeRun() : pauseRun();
                    toast({ tone: "info", title: paused ? "Run resumed" : "Run paused" });
                  }}
                  disabled={phase !== "running" || mode !== "sim"}
                  className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)] transition-transform hover:scale-110 disabled:opacity-40"
                  aria-label={paused ? "Resume run" : "Pause run"}
                >
                  {paused ? (
                    <Play className="h-1.5 w-1.5 text-black/0 transition-colors group-hover:text-black/60" />
                  ) : (
                    <Pause className="h-1.5 w-1.5 text-black/0 transition-colors group-hover:text-black/60" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label="Run again">
                <button
                  onClick={() =>
                    settled &&
                    void retryRun().then((id) => navigate(`/runs/${id}`, { replace: true }))
                  }
                  disabled={!settled}
                  className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)] transition-transform hover:scale-110 disabled:opacity-40"
                  aria-label="Run again"
                >
                  <RotateCcw className="h-1.5 w-1.5 text-black/0 transition-colors group-hover:text-black/60" />
                </button>
              </Tooltip>
            </div>

            <p className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 font-mono text-xs text-fg-faint sm:block">
              orchestrai — {runId}
            </p>

            <div className="ml-auto flex items-center gap-1.5">
              {phase === "running" && (
                <Button variant="danger" size="sm" onClick={() => cancelRun()}>
                  <Square className="h-3 w-3" /> Stop
                </Button>
              )}
              {settled && (
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() =>
                    void retryRun().then((id) => navigate(`/runs/${id}`, { replace: true }))
                  }
                >
                  <RotateCcw className="h-3 w-3" /> Run again
                </Button>
              )}
            </div>
          </div>

          {/* Metrics + activity inside the window */}
          <div className="space-y-3 border-b border-white/[0.06] px-4 py-3">
            <MetricsBar />
            <ActivityTicker />
          </div>

          {/* Window body: rail + tabbed workspace */}
          <div className="relative flex h-[72vh] min-h-[480px]">
            <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-white/[0.06] p-3 xl:block">
              <p className="mb-3 text-2xs font-medium uppercase tracking-[0.18em] text-fg-faint">
                Pipeline
              </p>
              <PipelineRail stages={stages} orientation="vertical" />
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-2 pt-1.5">
                <WorkTab id="reasoning" tab={tab} setTab={setTab} icon={<Brain className="h-3.5 w-3.5" />} label="Reasoning" />
                <WorkTab id="code" tab={tab} setTab={setTab} icon={<FileCode2 className="h-3.5 w-3.5" />} label="Code" count={fileCount || undefined} />
                <WorkTab id="preview" tab={tab} setTab={setTab} icon={<MonitorPlay className="h-3.5 w-3.5" />} label="Preview" count={htmlCount || undefined} />
                <WorkTab id="terminal" tab={tab} setTab={setTab} icon={<TerminalSquare className="h-3.5 w-3.5" />} label="Terminal" />
                <WorkTab id="tasks" tab={tab} setTab={setTab} icon={<GitBranch className="h-3.5 w-3.5" />} label="Tasks" />
              </div>

              <div className="relative min-h-0 flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    {tab === "reasoning" && <ReasoningFeed />}
                    {tab === "code" && <CodeViewer />}
                    {tab === "preview" && <PreviewPane />}
                    {tab === "terminal" && <LiveTerminal />}
                    {tab === "tasks" && <TaskGraph />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Completion / failure banner ─────────────────────────── */}
        <AnimatePresence>
          {finished && status === "reviewed" && (
            <Banner tone="ok">
              <CheckCircle2 className="h-4 w-4 text-ok" />
              <span>
                Build complete — {fileCount} files, review verdict{" "}
                <span className="font-medium text-ok">{review?.verdict ?? "approve"}</span>
                {review && review.findings.length > 0 && (
                  <span className="text-fg-muted">
                    {" "}
                    · {review.findings.length} findings worth reading
                  </span>
                )}
              </span>
            </Banner>
          )}
          {(cancelled || (finished && (status === "rejected" || status === "aborted"))) && (
            <Banner tone="warn">
              <Square className="h-4 w-4 text-warn" />
              <span>
                Run cancelled{status && status !== "aborted" ? ` — ${status}` : ""}. Nothing
                further will be spent.
              </span>
            </Banner>
          )}
          {failed && (
            <Banner tone="danger">
              <Square className="h-4 w-4 text-danger" />
              <span className="truncate">Run failed: {error}</span>
            </Banner>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}

function WorkTab({
  id,
  tab,
  setTab,
  icon,
  label,
  count,
}: {
  id: PanelTab;
  tab: PanelTab;
  setTab: (t: PanelTab) => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  const active = tab === id;
  return (
    <button
      onClick={() => setTab(id)}
      className={cn(
        "relative flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition-colors",
        active ? "text-fg" : "text-fg-faint hover:text-fg-muted",
      )}
    >
      {icon}
      {label}
      {count != null && (
        <span className="rounded-full bg-accent/20 px-1.5 text-2xs text-accent-bright">{count}</span>
      )}
      {active && (
        <motion.span
          layoutId="worktab-underline"
          className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}
    </button>
  );
}

function Banner({ tone, children }: { tone: "ok" | "warn" | "danger"; children: React.ReactNode }) {
  const cls = {
    ok: "border-ok/30 bg-ok/[0.08]",
    warn: "border-warn/30 bg-warn/[0.08]",
    danger: "border-danger/30 bg-danger/[0.08]",
  }[tone];
  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={cn(
        "mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm text-fg",
        cls,
      )}
    >
      {children}
    </motion.div>
  );
}
