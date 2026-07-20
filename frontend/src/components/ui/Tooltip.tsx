import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

/** Minimal, delayed tooltip with a soft pop. */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "right";
}) {
  const [show, setShow] = useState(false);
  const pos =
    side === "top"
      ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
      : side === "bottom"
        ? "top-full left-1/2 mt-2 -translate-x-1/2"
        : "left-full top-1/2 ml-2 -translate-y-1/2";

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={() => setShow(true)}
      onPointerLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9, y: side === "top" ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`glass-deep pointer-events-none absolute z-50 whitespace-nowrap rounded-md px-2.5 py-1 text-xs text-fg ${pos}`}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
