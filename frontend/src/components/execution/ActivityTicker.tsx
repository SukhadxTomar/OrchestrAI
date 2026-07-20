import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useRunStore } from "@/stores/runStore";

/**
 * The "it's alive" ticker: shows what the AI is doing right now with a
 * shimmering label and orbiting dots. Between events (long model calls),
 * it rotates through ambient waiting lines so the screen never feels dead.
 */
const AMBIENT = [
  "Thinking really hard…",
  "Consulting the blueprints…",
  "Turning coffee into code…",
  "Aligning the architecture…",
  "Choosing the perfect names…",
  "Dotting the i's, crossing the t's…",
  "Composing something elegant…",
  "Measuring twice, coding once…",
  "Untangling the dependencies…",
  "Summoning best practices…",
];

export function ActivityTicker() {
  const activity = useRunStore((s) => s.activity);
  const phase = useRunStore((s) => s.phase);
  const [ambientIdx, setAmbientIdx] = useState(0);
  const [sinceActivity, setSinceActivity] = useState(0);

  // Rotate ambient lines every 4s; reset staleness when real activity lands.
  useEffect(() => {
    setSinceActivity(0);
  }, [activity]);

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => {
      setSinceActivity((s) => s + 1);
      setAmbientIdx((i) => (i + 1) % AMBIENT.length);
    }, 4000);
    return () => clearInterval(t);
  }, [phase]);

  if (phase !== "running") return null;

  // Fresh event text for ~8s, then drift into ambient chatter.
  const label = activity && sinceActivity < 2 ? activity : AMBIENT[ambientIdx];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 overflow-hidden rounded-lg border border-accent/20 bg-accent/[0.06] px-3.5 py-2"
    >
      {/* orbiting dots */}
      <span className="relative h-4 w-4 shrink-0">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-accent-bright"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear", delay: i * 0.53 }}
            style={{ transformOrigin: "0 8px", translate: "-50% -8px" }}
          />
        ))}
      </span>

      <div className="relative min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={label}
            initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(3px)" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="truncate text-sm font-medium text-fg"
          >
            {label}
          </motion.p>
        </AnimatePresence>
        {/* shimmer sweep */}
        <motion.span
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, transparent 30%, rgba(157,143,255,0.18) 50%, transparent 70%)",
            backgroundSize: "200% 100%",
          }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse text-accent-bright" />
    </motion.div>
  );
}
