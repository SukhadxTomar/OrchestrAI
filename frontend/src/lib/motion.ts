/**
 * Motion language — one vocabulary for the whole app.
 *
 * Three tiers of movement:
 *   micro   (120–200ms) — hover, press, focus. Immediate, no spring overshoot.
 *   element (200–400ms) — cards, panels, list items. Soft spring.
 *   scene   (400–700ms) — page transitions, hero reveals. Expressive spring.
 *
 * Everything animates transform + opacity only (GPU-composited).
 */
import type { Transition, Variants } from "framer-motion";

export const spring = {
  micro: { type: "spring", stiffness: 700, damping: 40, mass: 0.6 } satisfies Transition,
  element: { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } satisfies Transition,
  scene: { type: "spring", stiffness: 190, damping: 26, mass: 1 } satisfies Transition,
  elastic: { type: "spring", stiffness: 300, damping: 16, mass: 0.8 } satisfies Transition,
};

export const easeOut = [0.22, 1, 0.36, 1] as const;

/** Page-level enter/exit — a vertical drift with a blur dissolve. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(4px)",
    transition: { duration: 0.22, ease: "easeIn" },
  },
};

/** Staggered reveal for lists/sections. Parent gets `stagger`, children get `rise`. */
export const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const rise: Variants = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0, transition: spring.scene },
};

export const riseSubtle: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: spring.element },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: spring.element },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};

/** Scroll-triggered reveal props (spread onto a motion element). */
export const scrollReveal = {
  initial: { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: easeOut },
} as const;
