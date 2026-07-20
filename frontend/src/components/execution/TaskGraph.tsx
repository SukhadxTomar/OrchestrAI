import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleDashed, GitBranch, Loader2, ShieldAlert, X } from "lucide-react";
import { useRunStore } from "@/stores/runStore";
import type { Task, TaskStatus } from "@/api/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<TaskStatus, { icon: React.ReactNode; cls: string; label: string }> = {
  pending: { icon: <CircleDashed className="h-3.5 w-3.5" />, cls: "text-fg-faint border-white/10", label: "pending" },
  in_progress: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, cls: "text-accent-bright border-accent/40 shadow-glow", label: "building" },
  verified: { icon: <Check className="h-3.5 w-3.5" />, cls: "text-ok border-ok/40", label: "verified" },
  failed: { icon: <X className="h-3.5 w-3.5" />, cls: "text-danger border-danger/40", label: "failed" },
  escalated: { icon: <ShieldAlert className="h-3.5 w-3.5" />, cls: "text-warn border-warn/40", label: "escalated" },
};

/** The plan as a living DAG list: dependencies, attempts, live status. */
export function TaskGraph() {
  const tasks = useRunStore((s) => s.tasks);

  if (tasks.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <GitBranch className="mx-auto mb-3 h-6 w-6 text-fg-ghost" />
          <p className="text-sm text-fg-faint">The task plan appears after planning completes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {tasks.map((task, i) => (
            <TaskRow key={task.id} task={task} index={i} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function TaskRow({ task, index }: { task: Task; index: number }) {
  const meta = STATUS_META[task.status];
  const active = task.status === "in_progress";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 30, delay: index * 0.05 }}
      className={cn(
        "rounded-lg border bg-white/[0.02] p-3 transition-all duration-slow",
        active ? "border-accent/40 bg-accent/[0.06]" : "border-white/[0.06]",
        task.status === "failed" && "border-danger/30 bg-danger/[0.04]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-ink-900",
            meta.cls,
          )}
        >
          {meta.icon}
        </span>
        <span className="font-mono text-2xs text-fg-faint">{task.id}</span>
        <span className={cn("ml-auto text-2xs", meta.cls.split(" ")[0])}>{meta.label}</span>
      </div>
      <p className="mt-1.5 text-sm leading-snug text-fg">{task.description}</p>
      <div className="mt-2 flex items-center gap-3 text-2xs text-fg-faint">
        {task.depends_on.length > 0 && (
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {task.depends_on.join(", ")}
          </span>
        )}
        {task.attempts > 0 && (
          <span className={cn(task.attempts > 1 && "text-warn")}>
            attempt {task.attempts}/{task.max_attempts}
          </span>
        )}
      </div>
    </motion.li>
  );
}
