import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * MagneticButton — the element leans toward the cursor within its bounds.
 * Wrap any interactive child; movement is pure transform (GPU).
 */
export function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.6 });

  return (
    <motion.div
      ref={ref}
      style={{ x: sx, y: sy }}
      className={cn("inline-block", className)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        x.set((e.clientX - rect.left - rect.width / 2) * strength);
        y.set((e.clientY - rect.top - rect.height / 2) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
