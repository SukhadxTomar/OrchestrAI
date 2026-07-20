import { AnimatePresence, motion } from "framer-motion";
import { Check, ShieldQuestion, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useRunStore } from "@/stores/runStore";
import { decideGate } from "@/api/runController";
import { toast } from "@/components/ui/Toast";
import { spring } from "@/lib/motion";

/**
 * ApprovalGate — the human-in-the-loop moment, rendered as a modal that
 * demands attention: the run is paused and money stops here.
 */
export function ApprovalGate() {
  const interrupt = useRunStore((s) => s.interrupt);
  const isEscalation = interrupt != null && interrupt.tasks == null && interrupt.spec == null;

  const decide = async (decision: "approve" | "reject" | "skip" | "abort") => {
    try {
      await decideGate(decision);
      toast({
        tone: decision === "approve" ? "success" : "info",
        title:
          decision === "approve"
            ? "Approved — the agents are back to work"
            : decision === "skip"
              ? "Task skipped"
              : "Run stopped",
      });
    } catch (e) {
      toast({ tone: "error", title: "Decision failed", detail: String(e) });
    }
  };

  return (
    <AnimatePresence>
      {interrupt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] grid place-items-center bg-ink-950/70 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.16 } }}
            transition={spring.element}
            className="glass-deep sheen w-full max-w-2xl overflow-hidden rounded-xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
              <span className="relative grid h-9 w-9 place-items-center rounded-full bg-warn/15 text-warn">
                <span className="absolute inset-0 animate-pulse-ring rounded-full border border-warn/50" />
                <ShieldQuestion className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-fg">{interrupt.question}</h2>
                <p className="text-xs text-fg-faint">
                  The run is paused. Nothing is spent until you decide.
                </p>
              </div>
              <Badge tone="warn" pulse className="ml-auto">
                awaiting you
              </Badge>
            </div>

            <div className="max-h-[46vh] overflow-y-auto px-6 py-4">
              {interrupt.spec && <SpecSummary />}
              {interrupt.tasks && <PlanSummary tasks={interrupt.tasks} />}
              {isEscalation && (
                <p className="text-sm text-fg-muted">
                  A task ran out of retries
                  {interrupt.task_id ? (
                    <> (<span className="font-mono text-warn">{String(interrupt.task_id)}</span>)</>
                  ) : null}
                  . Skip it and continue with the rest of the plan, or abort the run.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-4">
              {isEscalation ? (
                <>
                  <Button variant="danger" onClick={() => decide("abort")}>
                    <X className="h-4 w-4" /> Abort run
                  </Button>
                  <Button variant="glass" onClick={() => decide("skip")}>
                    <SkipForward className="h-4 w-4" /> Skip task
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => decide("reject")}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button variant="success" onClick={() => decide("approve")}>
                    <Check className="h-4 w-4" /> Approve & continue
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SpecSummary() {
  const spec = useRunStore((s) => s.interrupt?.spec);
  if (!spec) return null;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-fg">{spec.summary}</p>
      <div>
        <h3 className="mb-2 text-2xs font-medium uppercase tracking-[0.16em] text-fg-faint">
          Functional requirements
        </h3>
        <ul className="space-y-1.5">
          {spec.functional_requirements.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-fg-muted">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
              {r}
            </li>
          ))}
        </ul>
      </div>
      {spec.tech_stack.length > 0 && (
        <div>
          <h3 className="mb-2 text-2xs font-medium uppercase tracking-[0.16em] text-fg-faint">
            Stack
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {spec.tech_stack.map((t) => (
              <span key={t} className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-2xs text-fg-muted">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {spec.ambiguities.length > 0 && (
        <div>
          <h3 className="mb-2 text-2xs font-medium uppercase tracking-[0.16em] text-fg-faint">
            Decisions the Analyst made for you
          </h3>
          <ul className="space-y-2">
            {spec.ambiguities.map((a) => (
              <li key={a.question} className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-sm text-fg">{a.question}</p>
                {a.kind === "resolved" ? (
                  <p className="mt-1 text-xs text-fg-muted">
                    <span className="text-ok">→ {a.chosen_default}</span> — {a.rationale}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-warn">Needs your answer.</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PlanSummary({
  tasks,
}: {
  tasks: { id: string; description: string; depends_on: string[] }[];
}) {
  return (
    <ol className="space-y-2">
      {tasks.map((t, i) => (
        <motion.li
          key={t.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-start gap-3 rounded-lg bg-white/[0.03] p-3"
        >
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-2xs text-accent-bright">
            {t.id}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-fg">{t.description}</p>
            {t.depends_on.length > 0 && (
              <p className="mt-0.5 font-mono text-2xs text-fg-faint">
                after {t.depends_on.join(", ")}
              </p>
            )}
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
