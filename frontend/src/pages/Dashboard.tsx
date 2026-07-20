import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCode2,
  Pin,
  Plus,
  Search,
  ShieldQuestion,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/system/Logo";
import { usePalette } from "@/components/system/CommandPalette";
import { PromptInput } from "@/components/prompt/PromptInput";
import { Card } from "@/components/ui/Card";
import { Badge, Kbd } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { pageVariants, rise, stagger } from "@/lib/motion";
import { cn, formatUsd, timeAgo } from "@/lib/utils";
import { ACTIVITY, PROJECTS, SPEND, type ProjectCard } from "./dashboard/demoData";

export default function Dashboard() {
  const [params] = useSearchParams();
  const compose = params.get("compose") === "1";
  const [query, setQuery] = useState("");
  const { setOpen } = usePalette();

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? PROJECTS.filter(
          (p) => p.name.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q),
        )
      : PROJECTS;
    return [...list].sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false));
  }, [query]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="mx-auto flex min-h-screen max-w-[1500px]"
    >
      <Sidebar />

      <main className="min-w-0 flex-1 px-5 pb-16 pt-6 lg:px-8">
        {/* Top bar */}
        <div className="mb-8 flex items-center gap-3">
          <div className="lg:hidden">
            <Logo withWordmark={false} />
          </div>
          <div className="glass flex h-10 flex-1 items-center gap-2.5 rounded-lg px-3.5 sm:max-w-sm">
            <Search className="h-4 w-4 shrink-0 text-fg-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full bg-transparent text-sm text-fg placeholder:text-fg-faint focus:outline-none"
            />
          </div>
          <button
            onClick={() => setOpen(true)}
            className="hidden items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-fg-faint transition-colors hover:text-fg-muted md:flex"
          >
            Commands <Kbd>⌘K</Kbd>
          </button>
          <Badge tone="ok" pulse className="hidden sm:inline-flex">
            sample workspace
          </Badge>
        </div>

        {/* Composer */}
        <motion.section variants={stagger} initial="initial" animate="animate" className="mb-10">
          <motion.h1 variants={rise} className="mb-1 text-lg font-semibold tracking-tight text-fg">
            What are we building today?
          </motion.h1>
          <motion.p variants={rise} className="mb-5 text-sm text-fg-muted">
            Describe it once. The agents handle analysis, planning, code, tests, and review.
          </motion.p>
          <motion.div variants={rise}>
            <PromptInput size="md" autoFocus={compose} className="mx-0" />
          </motion.div>
        </motion.section>

        {/* Stats */}
        <section className="mb-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat
            icon={<Zap className="h-4 w-4 text-accent-bright" />}
            label="Runs this month"
            value={38}
          />
          <Stat
            icon={<CheckCircle2 className="h-4 w-4 text-ok" />}
            label="Verification pass rate"
            value={94}
            format={(v) => `${Math.round(v)}%`}
          />
          <Stat
            icon={<FileCode2 className="h-4 w-4 text-accent-cyan" />}
            label="Files generated"
            value={412}
          />
          <Stat
            icon={<DollarSign className="h-4 w-4 text-warn" />}
            label="Spend this month"
            value={23.41}
            format={(v) => `$${v.toFixed(2)}`}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            {/* Projects */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-fg">Projects</h2>
              <Link to="/runs/new?prompt=Build me a SaaS">
                <Button size="sm" variant="glass">
                  <Plus className="h-3.5 w-3.5" /> New run
                </Button>
              </Link>
            </div>
            <motion.div
              variants={stagger}
              initial="initial"
              animate="animate"
              className="grid gap-4 sm:grid-cols-2"
            >
              {projects.map((p) => (
                <motion.div key={p.id} variants={rise}>
                  <ProjectTile project={p} />
                </motion.div>
              ))}
              {projects.length === 0 && (
                <Card className="col-span-full grid place-items-center p-12 text-center">
                  <Sparkles className="mb-3 h-6 w-6 text-fg-ghost" />
                  <p className="text-sm text-fg-muted">No projects match “{query}”.</p>
                  <p className="mt-1 text-xs text-fg-faint">
                    Try a different search — or start a new build above.
                  </p>
                </Card>
              )}
            </motion.div>

            {/* Spend chart */}
            <h2 className="mb-4 mt-10 text-base font-medium text-fg">Spend — last 14 days</h2>
            <Card className="p-5">
              <SpendChart />
            </Card>
          </div>

          {/* Activity feed */}
          <aside className="min-w-0">
            <h2 className="mb-4 flex items-center gap-2 text-base font-medium text-fg">
              <Activity className="h-4 w-4 text-accent-bright" /> Activity
            </h2>
            <Card className="p-2">
              <ul>
                {ACTIVITY.map((item, i) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.05 }}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <ActivityIcon kind={item.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-fg">{item.text}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-fg-faint">
                        <span className="text-accent-bright/80">{item.run}</span>
                        <span>·</span>
                        <Clock className="h-3 w-3" />
                        {timeAgo(item.at)}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      </main>
    </motion.div>
  );
}

/* ── pieces ──────────────────────────────────────────────────────────── */

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-white/[0.05] p-5 lg:flex">
      <Logo />
      <nav className="flex flex-col gap-1">
        <SidebarLink to="/app" active label="Overview" icon={<Activity className="h-4 w-4" />} />
        <SidebarLink
          to="/runs/new?prompt=Build me a SaaS"
          label="New run"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <SidebarLink to="/" label="Home" icon={<ArrowUpRight className="h-4 w-4" />} />
      </nav>
      <div className="mt-auto">
        <Card className="p-4">
          <p className="mb-1 flex items-center gap-2 text-xs font-medium text-fg">
            <ShieldQuestion className="h-3.5 w-3.5 text-warn" />
            1 escalation waiting
          </p>
          <p className="text-2xs leading-relaxed text-fg-faint">
            Inkwell CMS · t5 needs S3 credentials to continue.
          </p>
        </Card>
      </div>
    </aside>
  );
}

function SidebarLink({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-fast",
        active
          ? "bg-accent/12 text-fg shadow-[inset_2px_0_0_#7c6bff]"
          : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function Stat({
  icon,
  label,
  value,
  format,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format?: (v: number) => string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.14em] text-fg-faint">
        {icon}
        {label}
      </div>
      <AnimatedCounter
        value={value}
        format={format}
        className="text-xl font-semibold tracking-tight text-fg"
      />
    </Card>
  );
}

const statusMeta: Record<
  ProjectCard["status"],
  { tone: "ok" | "accent" | "warn" | "danger"; label: string; pulse?: boolean }
> = {
  reviewed: { tone: "ok", label: "reviewed" },
  executing: { tone: "accent", label: "executing", pulse: true },
  halted: { tone: "warn", label: "halted" },
  failed: { tone: "danger", label: "failed" },
};

function ProjectTile({ project }: { project: ProjectCard }) {
  const navigate = useNavigate();
  const meta = statusMeta[project.status];
  return (
    <Card
      interactive
      onClick={() => navigate(`/runs/new?prompt=${encodeURIComponent(project.prompt)}`)}
      className="group p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-medium text-fg">
          {project.name}
          {project.pinned && <Pin className="h-3 w-3 text-fg-faint" />}
        </h3>
        <Badge tone={meta.tone} pulse={meta.pulse}>
          {meta.label}
        </Badge>
      </div>
      <p className="mb-4 line-clamp-2 text-sm text-fg-muted">“{project.prompt}”</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {project.stack.map((s) => (
          <span
            key={s}
            className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-2xs text-fg-faint"
          >
            {s}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-2xs text-fg-faint">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <FileCode2 className="h-3 w-3" /> {project.files}
          </span>
          <span>{formatUsd(project.costUsd, 2)}</span>
        </span>
        <span>{timeAgo(project.updatedAt)}</span>
      </div>
    </Card>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  const map: Record<string, React.ReactNode> = {
    verified: <CheckCircle2 className="h-4 w-4 text-ok" />,
    failed: <AlertTriangle className="h-4 w-4 text-danger" />,
    escalated: <ShieldQuestion className="h-4 w-4 text-warn" />,
    reviewed: <CheckCircle2 className="h-4 w-4 text-accent-cyan" />,
    started: <Zap className="h-4 w-4 text-accent-bright" />,
    gate: <ShieldQuestion className="h-4 w-4 text-accent-bright" />,
  };
  return <span className="mt-0.5 shrink-0">{map[kind] ?? map.started}</span>;
}

function SpendChart() {
  const max = Math.max(...SPEND.map((d) => d.usd));
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5 sm:gap-2.5">
        {SPEND.map((d, i) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <motion.div
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.045, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: `${(d.usd / max) * 100}%`, originY: 1 }}
              className="rounded-t-[4px] bg-gradient-to-t from-accent/35 to-accent/80 transition-colors group-hover:from-accent/60 group-hover:to-accent-bright"
            />
            <div className="glass-deep pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-2xs text-fg opacity-0 transition-opacity group-hover:opacity-100">
              {d.day} · ${d.usd.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-2xs text-fg-ghost">
        <span>{SPEND[0].day}</span>
        <span>{SPEND[SPEND.length - 1].day}</span>
      </div>
    </div>
  );
}
