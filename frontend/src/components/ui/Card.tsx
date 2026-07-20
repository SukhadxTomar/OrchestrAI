import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

export interface CardProps extends HTMLMotionProps<"div"> {
  interactive?: boolean;
  glow?: boolean;
  children?: ReactNode;
}

/** Glass card with hover lift. The default surface of the app. */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, glow, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={interactive ? { y: -3, scale: 1.005 } : undefined}
      transition={spring.element}
      className={cn(
        "glass sheen rounded-xl",
        interactive && "cursor-pointer transition-shadow duration-slow hover:shadow-e3",
        glow && "shadow-glow",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  ),
);
Card.displayName = "Card";
