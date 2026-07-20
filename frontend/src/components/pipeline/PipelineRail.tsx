import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { STAGES, type StageId, type StageState } from "@/api/types";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * The pipeline rail: nine stages with animated connectors.
 * Vertical on the execution page, horizontal-compact elsewhere.
 * Nodes pulse while active, glow when done, shake on failure.
 */
export function PipelineRail({
  stages,
  orientation = "vertical",
  onSelect,
  selected,
  className,
}: {
  stages: Record<StageId, StageState>;
  orientation?: "vertical" | "horizontal";
  onSelect?: (id: StageId) => void;
  selected?: StageId | null;
  className?: string;
}) {
  const vertical = orientation === "vertical";
  return (
    <div className={cn("flex", vertical ? "flex-col" : "flex-row items-center", className)}>
      {STAGES.map((stage, i) => {
        const state = stages[stage.id];
        return (
          <div
            key={stage.id}
            className={cn("flex", vertical ? "flex-col items-start" : "flex-row items-center")}
          >
            <StageNode
              id={stage.id}
              label={stage.label}
              blurb={stage.blurb}
              state={state}
              vertical={vertical}
              selected={selected === stage.id}
              onSelect={onSelect}
            />
            {i < STAGES.length - 1 && <Connector state={state} vertical={vertical} />}
          </div>
        );
      })}
    </div>
  );
}

function StageNode({
  id,
  label,
  blurb,
  state,
  vertical,
  selected,
  onSelect,
}: {
  id: StageId;
  label: string;
  blurb: string;
  state: StageState;
  vertical: boolean;
  selected?: boolean;
  onSelect?: (id: StageId) => void;
}) {
  const node = (
    <motion.button
      onClick={() => onSelect?.(id)}
      animate={
        state === "failed"
          ? { x: [0, -4, 4, -3, 3, 0], transition: { duration: 0.4 } }
          : undefined
      }
      whileHover={onSelect ? { scale: 1.03 } : undefined}
      whileTap={onSelect ? { scale: 0.97 } : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg py-1.5 pr-3 transition-colors",
        vertical ? "pl-1.5" : "px-1.5",
        onSelect && "hover:bg-white/[0.04]",
        selected && "bg-white/[0.05]",
      )}
    >
      <span className="relative grid h-8 w-8 shrink-0 place-items-center">
        {state === "active" && (
          <>
            <span className="absolute inset-0 animate-pulse-ring rounded-full border border-accent/70" />
            <span
              className="absolute inset-0 animate-pulse-ring rounded-full border border-accent/50"
              style={{ animationDelay: "0.5s" }}
            />
          </>
        )}
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-full border transition-all duration-slow",
            state === "idle" && "border-white/10 bg-white/[0.03] text-fg-ghost",
            state === "active" && "border-accent bg-accent/20 text-accent-bright shadow-glow",
            state === "waiting" && "border-warn/60 bg-warn/10 text-warn",
            state === "done" && "border-ok/50 bg-ok/10 text-ok shadow-glow-ok",
            state === "failed" && "border-danger/60 bg-danger/10 text-danger shadow-glow-danger",
          )}
        >
          {state === "done" ? (
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Check className="h-4 w-4" />
            </motion.span>
          ) : state === "active" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === "failed" ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : state === "waiting" ? (
            <span className="h-2 w-2 animate-pulse rounded-full bg-warn" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
      </span>
      {vertical && (
        <span className="text-left">
          <span
            className={cn(
              "block text-sm font-medium transition-colors",
              state === "idle" ? "text-fg-faint" : "text-fg",
            )}
          >
            {label}
          </span>
          <span className="block text-2xs text-fg-faint">{blurb}</span>
        </span>
      )}
    </motion.button>
  );

  return vertical ? node : <Tooltip label={`${label} — ${blurb}`}>{node}</Tooltip>;
}

function Connector({ state, vertical }: { state: StageState; vertical: boolean }) {
  const lit = state === "done";
  return (
    <span
      className={cn(
        "relative overflow-hidden",
        vertical ? "ml-[21px] h-5 w-px" : "h-px w-6",
      )}
    >
      <span className="absolute inset-0 bg-white/10" />
      <motion.span
        initial={false}
        animate={lit ? { scaleY: 1, scaleX: 1, opacity: 1 } : { scaleY: 0, scaleX: 0, opacity: 0 }}
        style={{ originY: 0, originX: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 bg-gradient-to-b from-ok/80 to-accent/60"
      />
    </span>
  );
}
