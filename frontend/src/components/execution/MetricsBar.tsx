import { useEffect, useState } from "react";
import { Clock, Cpu, DollarSign, FileCode2, Gauge } from "lucide-react";
import { useRunStore } from "@/stores/runStore";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { formatDuration, formatTokens } from "@/lib/utils";

/** The Mission Control metrics strip: tokens, cost, speed, files, elapsed. */
export function MetricsBar() {
  const metrics = useRunStore((s) => s.metrics);
  const phase = useRunStore((s) => s.phase);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const elapsed = metrics.startedAt
    ? (metrics.endedAt ?? (phase === "running" ? now : Date.now())) - metrics.startedAt
    : 0;
  const totalTokens = metrics.promptTokens + metrics.completionTokens;
  const tokensPerSec = metrics.llmMs > 0 ? metrics.completionTokens / (metrics.llmMs / 1000) : 0;

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/[0.05] sm:grid-cols-5">
      <Metric
        icon={<Cpu className="h-3.5 w-3.5 text-accent-cyan" />}
        label="Tokens"
        value={totalTokens}
        format={(v) => formatTokens(Math.round(v))}
        sub={`${metrics.llmCalls} LLM calls`}
      />
      <Metric
        icon={<DollarSign className="h-3.5 w-3.5 text-warn" />}
        label="Cost"
        value={metrics.costUsd}
        format={(v) => `$${v.toFixed(4)}`}
        sub="of run budget"
      />
      <Metric
        icon={<Gauge className="h-3.5 w-3.5 text-accent-bright" />}
        label="Throughput"
        value={tokensPerSec}
        format={(v) => `${v.toFixed(0)} tok/s`}
        sub="generation speed"
      />
      <Metric
        icon={<FileCode2 className="h-3.5 w-3.5 text-ok" />}
        label="Files"
        value={metrics.filesWritten}
        format={(v) => String(Math.round(v))}
        sub={`${metrics.commands} commands run`}
      />
      <Metric
        icon={<Clock className="h-3.5 w-3.5 text-fg-muted" />}
        label="Elapsed"
        value={elapsed}
        format={(v) => formatDuration(v)}
        sub={phase === "running" ? "in flight" : "final"}
        live={phase === "running"}
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  format,
  sub,
  live,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format: (v: number) => string;
  sub: string;
  live?: boolean;
}) {
  return (
    <div className="bg-ink-900/80 px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-fg-faint">
        {icon}
        {label}
        {live && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />}
      </div>
      <AnimatedCounter
        value={value}
        format={format}
        className="font-mono text-lg font-semibold tracking-tight text-fg"
      />
      <p className="mt-0.5 text-2xs text-fg-ghost">{sub}</p>
    </div>
  );
}
