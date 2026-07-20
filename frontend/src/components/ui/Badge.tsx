import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "cyan";

const tones: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-fg-muted",
  accent: "bg-accent/15 text-accent-bright",
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/12 text-warn",
  danger: "bg-danger/12 text-danger",
  cyan: "bg-accent-cyan/12 text-accent-cyan",
};

export function Badge({
  tone = "neutral",
  pulse,
  className,
  children,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-white/10 bg-white/[0.04] px-1.5 font-mono text-2xs text-fg-muted shadow-[0_1px_0_rgba(255,255,255,0.06)]">
      {children}
    </kbd>
  );
}
