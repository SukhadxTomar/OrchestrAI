import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

/** Counts smoothly to `value`. Formatting is caller-supplied. */
export function AnimatedCounter({
  value,
  format = (v) => Math.round(v).toLocaleString(),
  className,
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const raw = useMotionValue(0);
  const smooth = useSpring(raw, { stiffness: 90, damping: 24 });
  const text = useTransform(smooth, format);

  useEffect(() => {
    raw.set(value);
  }, [value, raw]);

  return <motion.span className={className}>{text}</motion.span>;
}
