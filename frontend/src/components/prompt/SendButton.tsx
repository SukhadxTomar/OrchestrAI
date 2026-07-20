import { memo } from "react";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SendButton — the circular launch control.
 *
 * Fixed footprint at every state (idle/hover/loading/disabled) so the
 * composer's layout never shifts. All movement is transform-only.
 */
export const SendButton = memo(function SendButton({
  onClick,
  disabled,
  loading,
  size = 54,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: number;
  className?: string;
}) {
  const inert = disabled || loading;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={inert}
      aria-label={loading ? "Starting build…" : "Start building"}
      whileHover={inert ? undefined : { scale: 1.03, y: -1 }}
      whileTap={inert ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      style={{ width: size, height: size }}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full",
        "bg-gradient-to-br from-accent-bright via-accent to-accent-dim text-white",
        "shadow-[0_2px_16px_rgba(124,107,255,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]",
        "transition-[box-shadow,opacity] duration-200 ease-out",
        !inert &&
          "hover:shadow-[0_4px_28px_rgba(124,107,255,0.65),inset_0_1px_0_rgba(255,255,255,0.3)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright",
        disabled && !loading && "opacity-45 saturate-[0.6]",
        loading && "cursor-wait",
        className,
      )}
    >
      {/* Icon and spinner swap with a cross-fade; both absolutely centered
          so the button's box never changes. */}
      <motion.span
        initial={false}
        animate={{ opacity: loading ? 0 : 1, scale: loading ? 0.6 : 1 }}
        transition={{ duration: 0.15 }}
        className="absolute"
      >
        <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
      </motion.span>
      <motion.span
        initial={false}
        animate={{ opacity: loading ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        className="absolute"
        aria-hidden={!loading}
      >
        <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </motion.span>
    </motion.button>
  );
});
