import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { create } from "zustand";
import {
  Command as CommandIcon,
  Home,
  LayoutDashboard,
  Play,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Kbd } from "@/components/ui/Badge";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface PaletteStore {
  open: boolean;
  setOpen(open: boolean): void;
}

export const usePalette = create<PaletteStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

interface Action {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run(navigate: (to: string) => void): void;
}

const ACTIONS: Action[] = [
  {
    id: "new-run",
    label: "Start a new build",
    hint: "prompt → software",
    icon: <Sparkles className="h-4 w-4 text-accent-bright" />,
    run: (nav) => nav("/app?compose=1"),
  },
  {
    id: "dashboard",
    label: "Go to Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    run: (nav) => nav("/app"),
  },
  {
    id: "home",
    label: "Go to Home",
    icon: <Home className="h-4 w-4" />,
    run: (nav) => nav("/"),
  },
  {
    id: "demo",
    label: "Run demo execution",
    hint: "watch the agents work",
    icon: <Play className="h-4 w-4 text-ok" />,
    run: (nav) => nav("/runs/new?prompt=Build me a SaaS for team invoicing"),
  },
  {
    id: "terminal",
    label: "Focus terminal",
    hint: "on execution screen",
    icon: <Terminal className="h-4 w-4" />,
    run: () => document.querySelector<HTMLElement>("[data-terminal]")?.scrollIntoView({ behavior: "smooth" }),
  },
];

export function CommandPalette() {
  const { open, setOpen } = usePalette();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(q) || a.hint?.includes(q));
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!usePalette.getState().open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const commit = (action: Action | undefined) => {
    if (!action) return;
    setOpen(false);
    action.run(navigate);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] bg-ink-950/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8, transition: { duration: 0.12 } }}
            transition={spring.element}
            onClick={(e) => e.stopPropagation()}
            className="glass-deep sheen mx-auto mt-[16vh] w-full max-w-xl overflow-hidden rounded-xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
              <Search className="h-4 w-4 text-fg-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIndex((i) => Math.min(i + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    commit(results[index]);
                  }
                }}
                placeholder="Type a command…"
                className="h-12 w-full bg-transparent text-sm text-fg placeholder:text-fg-faint focus:outline-none"
              />
              <Kbd>esc</Kbd>
            </div>
            <ul className="max-h-72 overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-fg-faint">No matches.</li>
              )}
              {results.map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <button
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => commit(a)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-fast",
                      i === index ? "bg-accent/15 text-fg" : "text-fg-muted hover:bg-white/[0.04]",
                    )}
                  >
                    {a.icon}
                    <span className="flex-1">{a.label}</span>
                    {a.hint && <span className="text-2xs text-fg-faint">{a.hint}</span>}
                  </button>
                </motion.li>
              ))}
            </ul>
            <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-2 text-2xs text-fg-faint">
              <CommandIcon className="h-3 w-3" />
              <span>↑↓ navigate</span>
              <span>↵ select</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
