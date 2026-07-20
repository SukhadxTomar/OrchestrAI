import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

type Variant = "primary" | "glass" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "size" | "children">,
    Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-glow hover:bg-accent-bright disabled:bg-ink-600 disabled:shadow-none",
  glass:
    "glass text-fg hover:bg-white/[0.07] disabled:text-fg-faint",
  ghost:
    "text-fg-muted hover:text-fg hover:bg-white/[0.05] disabled:text-fg-ghost",
  danger:
    "bg-danger/15 text-danger shadow-glow-danger hover:bg-danger/25 disabled:opacity-40",
  success:
    "bg-ok/15 text-ok shadow-glow-ok hover:bg-ok/25 disabled:opacity-40",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-base rounded-lg gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileHover={disabled || loading ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={spring.micro}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center font-medium",
        "transition-colors duration-fast focus-visible:outline-accent",
        "disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
        </span>
      )}
      <span className={cn("inline-flex items-center gap-inherit gap-2", loading && "opacity-0")}>
        {children}
      </span>
    </motion.button>
  ),
);
Button.displayName = "Button";
