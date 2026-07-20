import { motion } from "framer-motion";

/** Full-screen suspense fallback: a breathing orb, not a spinner. */
export function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative h-16 w-16"
      >
        <motion.span
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-accent/30 blur-xl"
        />
        <motion.span
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-3 rounded-full border border-accent/50 bg-accent/10"
        />
      </motion.div>
    </div>
  );
}
