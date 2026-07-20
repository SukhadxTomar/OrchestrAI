import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  GitBranch,
  Shield,
  Sparkles,
  TerminalSquare,
  Workflow,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/system/Logo";
import { PromptInput } from "@/components/prompt/PromptInput";
import { PipelineRail } from "@/components/pipeline/PipelineRail";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, Kbd } from "@/components/ui/Badge";
import { Magnetic } from "@/components/ui/Magnetic";
import { pageVariants, rise, scrollReveal, stagger } from "@/lib/motion";
import { usePalette } from "@/components/system/CommandPalette";
import type { StageId, StageState } from "@/api/types";
import { STAGES } from "@/api/types";

export default function Landing() {
  return (
    <motion.main variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <Nav />
      <Hero />
      <LivePipelineSection />
      <Features />
      <ArchitectureSection />
      <Testimonials />
      <Pricing />
      <FinalCta />
      <Footer />
    </motion.main>
  );
}

/* ── nav ─────────────────────────────────────────────────────────────── */

function Nav() {
  const { setOpen } = usePalette();
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto mt-4 flex max-w-6xl items-center justify-between gap-4 rounded-xl px-4 py-2.5 glass sheen sm:px-5">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm text-fg-muted md:flex">
          {["Product", "Pipeline", "Architecture", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.05] hover:text-fg"
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-fg-faint transition-colors hover:border-white/[0.16] hover:text-fg-muted sm:flex"
          >
            Search <Kbd>⌘K</Kbd>
          </button>
          <Link to="/app">
            <Button size="sm">Open Console</Button>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}

/* ── hero ────────────────────────────────────────────────────────────── */

function Hero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 120]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0.25]);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-4 pt-28">
      <motion.div style={{ y, opacity }} className="flex w-full max-w-4xl flex-col items-center">
        <motion.div variants={stagger} initial="initial" animate="animate" className="contents">
          <motion.div variants={rise}>
            <Badge tone="accent" pulse className="mb-6">
              Autonomous engineering, shipped
            </Badge>
          </motion.div>

          <motion.h1
            variants={rise}
            className="text-center text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            <span className="text-aurora">One prompt.</span>
            <br />
            <span className="text-fg">An entire engineering team.</span>
          </motion.h1>

          <motion.p
            variants={rise}
            className="mt-6 max-w-xl text-center text-md text-fg-muted"
          >
            OrchestrAI reads your intent, plans the architecture, writes the code, runs the
            tests, debugs its own failures, and reviews the result — while you watch every
            thought unfold in real time.
          </motion.p>

          <motion.div variants={rise} className="mt-10 w-full">
            <PromptInput size="lg" />
          </motion.div>

          <motion.div
            variants={rise}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-fg-faint"
          >
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-ok" /> Human approval gates
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-warn" /> Self-healing verification loop
            </span>
            <span className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-accent-cyan" /> Dependency-aware task DAG
            </span>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="absolute bottom-8 flex flex-col items-center gap-2 text-fg-ghost"
      >
        <span className="text-2xs uppercase tracking-[0.2em]">Watch it think</span>
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="h-8 w-px bg-gradient-to-b from-fg-ghost to-transparent"
        />
      </motion.div>
    </section>
  );
}

/* ── live pipeline demo ──────────────────────────────────────────────── */

const DEMO_LINES = [
  { c: "text-accent-bright", t: "◆ analyzing prompt — extracting requirements" },
  { c: "text-fg-muted", t: "  found 5 functional requirements, 2 ambiguities resolved" },
  { c: "text-accent-bright", t: "◆ planning — decomposing into task DAG" },
  { c: "text-fg-muted", t: "  5 tasks · dependencies validated · acyclic ✓" },
  { c: "text-accent-cyan", t: "▸ t1 scaffold project" },
  { c: "text-fg-muted", t: "  write nimbus/config.py (412 B)" },
  { c: "text-fg-muted", t: "  write nimbus/main.py (688 B)" },
  { c: "text-ok", t: "  ✓ pytest -q — 3 passed" },
  { c: "text-accent-cyan", t: "▸ t4 core API routes" },
  { c: "text-danger", t: "  ✗ test_item_crud — AssertionError: total == 0" },
  { c: "text-warn", t: "◆ debugging — reading the failure, patching routes.py" },
  { c: "text-ok", t: "  ✓ pytest -q — 11 passed (attempt 2)" },
  { c: "text-ok", t: "✓ review complete — approve_with_findings · README written" },
];

function LivePipelineSection() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % (DEMO_LINES.length + 6)), 900);
    return () => clearInterval(t);
  }, []);

  // Derive stage states from demo progress for the rail.
  const stageStates = Object.fromEntries(
    STAGES.map((s, i) => {
      const threshold = Math.floor((i / STAGES.length) * (DEMO_LINES.length + 4));
      const state: StageState =
        step > threshold + 1 ? "done" : step >= threshold ? "active" : "idle";
      return [s.id, state];
    }),
  ) as Record<StageId, StageState>;

  return (
    <section id="pipeline" className="mx-auto max-w-6xl px-4 py-28">
      <motion.div {...scrollReveal} className="mb-12 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-fg">
          Intelligence you can <span className="text-aurora">watch</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-fg-muted">
          Not a progress bar. A live nervous system — every agent decision, file write, and
          test run streams to your screen as it happens.
        </p>
      </motion.div>

      <motion.div {...scrollReveal} className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="hidden p-5 lg:block">
          <p className="mb-4 text-2xs font-medium uppercase tracking-[0.18em] text-fg-faint">
            Pipeline
          </p>
          <PipelineRail stages={stageStates} orientation="vertical" />
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-ok/80" />
            <span className="ml-3 font-mono text-xs text-fg-faint">
              orchestrai · run f4a91c2e
            </span>
            <Badge tone="ok" pulse className="ml-auto">
              live
            </Badge>
          </div>
          <div className="h-[380px] overflow-hidden p-5 font-mono text-[13px] leading-6">
            {DEMO_LINES.slice(0, Math.min(step, DEMO_LINES.length)).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={line.c}
              >
                {line.t}
              </motion.div>
            ))}
            <span className="animate-blink text-accent-bright">▍</span>
          </div>
        </Card>
      </motion.div>
    </section>
  );
}

/* ── features ────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: <Bot className="h-5 w-5 text-accent-bright" />,
    title: "Five specialist agents",
    body: "Analyst, Planner, Coder, Debugger, Reviewer — each with one job, orchestrated as a graph, never a monolithic prompt.",
  },
  {
    icon: <Workflow className="h-5 w-5 text-accent-cyan" />,
    title: "Validated task DAG",
    body: "Plans are dependency graphs, proven acyclic at construction. Nothing builds before what it depends on.",
  },
  {
    icon: <Zap className="h-5 w-5 text-warn" />,
    title: "Self-healing loop",
    body: "Every task is verified: syntax, dependencies, tests. Failures route to the Debugger with bounded retries — then escalate to you.",
  },
  {
    icon: <Shield className="h-5 w-5 text-ok" />,
    title: "Human approval gates",
    body: "The run pauses before planning and before spending on code. You approve the spec and the plan — you stay in command.",
  },
  {
    icon: <Braces className="h-5 w-5 text-accent-bright" />,
    title: "Typed end to end",
    body: "Frozen domain models, structured LLM outputs, enforced task state machines. Illegal states are unrepresentable.",
  },
  {
    icon: <TerminalSquare className="h-5 w-5 text-accent-cyan" />,
    title: "Total observability",
    body: "Token usage, cost, duration, and every sandbox command stream over WebSocket. The trace is the product.",
  },
];

function Features() {
  return (
    <section id="product" className="mx-auto max-w-6xl px-4 py-28">
      <motion.div {...scrollReveal} className="mb-12">
        <h2 className="text-xl font-semibold tracking-tight text-fg">
          Engineered like the software it writes
        </h2>
        <p className="mt-3 max-w-xl text-base text-fg-muted">
          Every guarantee in the product is a guarantee in the architecture.
        </p>
      </motion.div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card interactive className="h-full p-6">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-white/[0.05]">
                {f.icon}
              </div>
              <h3 className="mb-2 text-base font-medium text-fg">{f.title}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{f.body}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── architecture ────────────────────────────────────────────────────── */

function ArchitectureSection() {
  const nodes = [
    { label: "Analyst", x: 8, y: 20 },
    { label: "Planner", x: 30, y: 55 },
    { label: "Coder", x: 52, y: 22 },
    { label: "Debugger", x: 72, y: 58 },
    { label: "Reviewer", x: 90, y: 25 },
  ];
  return (
    <section id="architecture" className="mx-auto max-w-6xl px-4 py-28">
      <motion.div {...scrollReveal} className="mb-12 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-fg">
          A graph, not a chain
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-fg-muted">
          LangGraph orchestration with checkpointed state — pause a run for days, answer a
          gate, and it resumes exactly where it stopped.
        </p>
      </motion.div>
      <motion.div {...scrollReveal}>
        <Card className="relative h-72 overflow-hidden p-6">
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 80">
            {nodes.slice(0, -1).map((n, i) => {
              const next = nodes[i + 1];
              return (
                <motion.line
                  key={i}
                  x1={n.x + 3}
                  y1={n.y + 3}
                  x2={next.x + 3}
                  y2={next.y + 3}
                  stroke="url(#arch-g)"
                  strokeWidth="0.35"
                  strokeDasharray="2 1.4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.7 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, delay: 0.3 + i * 0.22 }}
                />
              );
            })}
            <defs>
              <linearGradient id="arch-g" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7c6bff" />
                <stop offset="100%" stopColor="#4cc9f0" />
              </linearGradient>
            </defs>
          </svg>
          {nodes.map((n, i) => (
            <motion.div
              key={n.label}
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 + i * 0.18 }}
              className="absolute"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
                className="glass flex items-center gap-2 rounded-lg px-3.5 py-2 shadow-glow"
              >
                <span className="h-2 w-2 rounded-full bg-accent-bright" />
                <span className="text-sm font-medium text-fg">{n.label}</span>
              </motion.div>
            </motion.div>
          ))}
        </Card>
      </motion.div>
    </section>
  );
}

/* ── testimonials ────────────────────────────────────────────────────── */

const QUOTES = [
  {
    quote:
      "I typed one sentence before lunch. When I came back there was a tested API, a failure it had found and fixed itself, and a review telling me about a validation edge case I'd have missed.",
    name: "Sofia Reyes",
    role: "Staff Engineer, Meridian",
  },
  {
    quote:
      "The approval gates are the genius part. It doesn't pretend to be magic — it shows its plan, asks permission before spending, and escalates when it's stuck. Like a great senior hire.",
    name: "Dan Okafor",
    role: "CTO, Fieldstone",
  },
  {
    quote:
      "Watching the execution screen is the closest I've felt to watching a team think. We keep it on the wall display during builds.",
    name: "Mei Lin",
    role: "Platform Lead, Arcline",
  },
];

function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-28">
      <div className="grid gap-4 md:grid-cols-3">
        {QUOTES.map((q, i) => (
          <motion.div
            key={q.name}
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="flex h-full flex-col p-6">
              <p className="flex-1 text-sm leading-relaxed text-fg-muted">“{q.quote}”</p>
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <p className="text-sm font-medium text-fg">{q.name}</p>
                <p className="text-xs text-fg-faint">{q.role}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── pricing ─────────────────────────────────────────────────────────── */

const PLANS = [
  {
    name: "Solo",
    price: "$0",
    note: "for exploring",
    features: ["3 runs / day", "$2 budget cap per run", "Community support", "Local sandbox"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Studio",
    price: "$49",
    note: "per seat / month",
    features: [
      "Unlimited runs",
      "Configurable budgets",
      "Priority model routing",
      "Run history & traces",
      "Approval gate webhooks",
    ],
    cta: "Start building",
    featured: true,
  },
  {
    name: "Fleet",
    price: "Custom",
    note: "for platform teams",
    features: [
      "Isolated sandboxes",
      "SSO & audit log",
      "Private model endpoints",
      "Dedicated support",
    ],
    cta: "Talk to us",
    featured: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-28">
      <motion.div {...scrollReveal} className="mb-12 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-fg">
          Pay for outcomes, not seats at a chatbot
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-fg-muted">
          Every run has a hard budget. The platform stops spending the moment you say so.
        </p>
      </motion.div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card
              glow={plan.featured}
              className={`relative flex h-full flex-col p-6 ${plan.featured ? "border border-accent/30" : ""}`}
            >
              {plan.featured && (
                <Badge tone="accent" className="absolute -top-2.5 left-6">
                  Most popular
                </Badge>
              )}
              <h3 className="text-base font-medium text-fg">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight text-fg">{plan.price}</span>
                <span className="text-xs text-fg-faint">{plan.note}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-fg-muted">
                    <Check className="h-3.5 w-3.5 shrink-0 text-ok" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/app" className="mt-6">
                <Button variant={plan.featured ? "primary" : "glass"} className="w-full">
                  {plan.cta}
                </Button>
              </Link>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── final CTA + footer ──────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-32 text-center">
      <motion.div {...scrollReveal}>
        <Sparkles className="mx-auto mb-6 h-8 w-8 text-accent-bright" />
        <h2 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          The next thing you ship
          <br />
          <span className="text-aurora">starts with a sentence.</span>
        </h2>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Magnetic>
            <Link to="/app">
              <Button size="lg">
                Open the console <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Magnetic>
          <Link to="/runs/new?prompt=Build me a SaaS">
            <Button size="lg" variant="glass">
              Watch a live run
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.05] px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Logo size={20} />
        <p className="text-xs text-fg-faint">
          © 2026 OrchestrAI. Software that writes software.
        </p>
      </div>
    </footer>
  );
}
