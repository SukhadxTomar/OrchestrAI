import { type ReactNode, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.15 } }}
            transition={spring.element}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "glass-deep sheen relative w-full rounded-xl p-6",
              wide ? "max-w-3xl" : "max-w-lg",
            )}
          >
            {title && <h2 className="mb-4 pr-8 text-lg font-semibold text-fg">{title}</h2>}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-md p-1.5 text-fg-faint transition-colors hover:bg-white/[0.06] hover:text-fg"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
