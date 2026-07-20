import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * SVG progress ring with an animated sweep and soft glow.
 * `value` is 0..1. Indeterminate mode spins a partial arc.
 */
export function ProgressRing({
  value,
  size = 56,
  stroke = 4,
  indeterminate,
  tone = "accent",
  className,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  indeterminate?: boolean;
  tone?: "accent" | "ok" | "danger" | "warn";
  className?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const colors = {
    accent: "stroke-accent",
    ok: "stroke-ok",
    danger: "stroke-danger",
    warn: "stroke-warn",
  } as const;

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <motion.svg
        width={size}
        height={size}
        className={cn(indeterminate && "animate-spin [animation-duration:1.4s]")}
        style={{ rotate: -90 }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-white/[0.07]"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn(colors[tone], "drop-shadow-[0_0_6px_rgba(124,107,255,0.6)]")}
          strokeDasharray={c}
          animate={{ strokeDashoffset: indeterminate ? c * 0.72 : c * (1 - Math.min(1, value)) }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
      </motion.svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
