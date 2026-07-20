import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Cpu,
  FileCode2,
  ShieldQuestion,
  TerminalSquare,
  XCircle,
  Zap,
} from "lucide-react";
import { useRunStore } from "@/stores/runStore";
import type { FeedItem } from "@/api/types";

const KIND_META: Record<
  FeedItem["kind"],
  { icon: React.ReactNode; color: string }
> = {
  thought: { icon: <Brain className="h-3.5 w-3.5" />, color: "text-accent-bright" },
  llm: { icon: <Cpu className="h-3.5 w-3.5" />, color: "text-accent-cyan" },
  file: { icon: <FileCode2 className="h-3.5 w-3.5" />, color: "text-fg-muted" },
  command: { icon: <TerminalSquare className="h-3.5 w-3.5" />, color: "text-fg-muted" },
  "verify-pass": { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-ok" },
  "verify-fail": { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-danger" },
  escalate: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-warn" },
  gate: { icon: <ShieldQuestion className="h-3.5 w-3.5" />, color: "text-warn" },
  system: { icon: <Zap className="h-3.5 w-3.5" />, color: "text-fg-faint" },
};

/**
 * The reasoning timeline — every agent thought and action, streaming.
 * This is where "watching intelligence work" lives.
 */
export function ReasoningFeed() {
  const feed = useRunStore((s) => s.feed);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feed.length]);

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      {feed.length === 0 && (
        <div className="grid h-full place-items-center text-center">
          <div>
            <Brain className="mx-auto mb-3 h-6 w-6 animate-pulse text-fg-ghost" />
            <p className="text-sm text-fg-faint">Waiting for the first thought…</p>
          </div>
        </div>
      )}
      <ol className="relative ml-1.5 border-l border-white/[0.07]">
        <AnimatePresence initial={false}>
          {feed.map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -14, filter: "blur(3px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="relative py-1.5 pl-6"
              >
                <span
                  className={`absolute -left-[9px] top-2 grid h-[18px] w-[18px] place-items-center rounded-full bg-ink-900 ${meta.color}`}
                >
                  {meta.icon}
                </span>
                <p className="text-sm leading-snug text-fg">{item.text}</p>
                {item.detail && (
                  <p className="mt-0.5 break-words font-mono text-2xs leading-relaxed text-fg-faint">
                    {item.detail}
                  </p>
                )}
                <p className="mt-0.5 text-2xs text-fg-ghost">
                  {new Date(item.at).toLocaleTimeString(undefined, {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      <div ref={bottomRef} />
    </div>
  );
}
