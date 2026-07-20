import {
  memo,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { GhostPlaceholder } from "./GhostPlaceholder";
import { SendButton } from "./SendButton";
import { Kbd } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Build me a SaaS",
  "Build a calculator web app in a single HTML file",
  "Build a REST API for team invoicing with JWT auth",
  "Build a real-time chat service",
  "Build a URL shortener with analytics",
];

/**
 * PromptInput — the flagship composer the whole product revolves around.
 *
 * Architecture notes (why it doesn't glitch):
 *  • Auto-grow is react-textarea-autosize — battle-tested, no scrollHeight
 *    thrashing, no caret jumps. Max ~5 rows, then internal scroll.
 *  • The ghost suggestion is a separate memoized overlay; its 50ms ticks
 *    never re-render the textarea (typing stays jitter-free).
 *  • The send button lives in a fixed-width column, vertically centered
 *    for one line, and pins to the bottom as the textarea grows — it never
 *    moves *while* typing on a line.
 *  • Focus ring + ambient glow are pure box-shadow/opacity transitions on
 *    a wrapper — zero layout cost.
 */
export const PromptInput = memo(function PromptInput({
  size = "lg",
  autoFocus,
  className,
}: {
  size?: "lg" | "md";
  autoFocus?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  const lg = size === "lg";
  const empty = value.trim().length === 0;

  const submit = useCallback(() => {
    if (sending) return; // no duplicate launches
    const prompt = value.trim() || SUGGESTIONS[0];
    setSending(true);
    // Navigation is instant, but keep the state honest for the frame it lasts.
    navigate(`/runs/new?prompt=${encodeURIComponent(prompt)}`);
  }, [sending, value, navigate]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const isSubmit =
        (e.key === "Enter" && !e.shiftKey) ||
        (e.key === "Enter" && (e.metaKey || e.ctrlKey));
      if (isSubmit) {
        e.preventDefault();
        submit();
      }
      // Shift+Enter falls through → newline, native behavior.
    },
    [submit],
  );

  return (
    <div className={cn("mx-auto w-full", lg ? "max-w-[900px]" : "max-w-2xl", className)}>
      {/* Ambient glow bed — sits behind, breathes on focus */}
      <div className="relative">
        <div
          aria-hidden
          className={cn(
            "absolute -inset-3 rounded-[36px] transition-opacity duration-500 ease-out",
            "bg-[radial-gradient(60%_100%_at_50%_50%,rgba(124,107,255,0.16),transparent_70%)]",
            focused ? "opacity-100" : "opacity-0",
          )}
        />

        {/* The vessel */}
        <motion.div
          whileHover={{ y: -1 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className={cn(
            "group relative overflow-hidden rounded-[28px]",
            // glass
            "bg-[linear-gradient(165deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)_45%,rgba(255,255,255,0.04))]",
            "backdrop-blur-2xl backdrop-saturate-150",
            // depth: layered shadow + hairline, deepens on focus
            "shadow-[0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_0_0_1px_rgba(255,255,255,0.05)]",
            "transition-shadow duration-200 ease-out",
            focused &&
              "shadow-[0_12px_56px_rgba(0,0,0,0.55),0_0_0_1.5px_rgba(124,107,255,0.55),0_0_36px_rgba(124,107,255,0.22),inset_0_1px_0_rgba(255,255,255,0.1)]",
            !focused &&
              "hover:shadow-[0_10px_48px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.09),inset_0_0_0_1px_rgba(255,255,255,0.09)]",
          )}
        >
          {/* Thin gradient border sheen along the top */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
          />

          {/* Input row: icon | textarea | send. The send column is fixed-width;
              items-end pins the button to the last line as the field grows. */}
          <div className={cn("flex items-end gap-3", lg ? "p-4 pl-6 sm:p-5 sm:pl-7" : "p-3 pl-4")}>
            {/* Spark — aligned to the first text line, not stretched */}
            <div
              className={cn("flex shrink-0 items-center", lg ? "h-[54px]" : "h-[42px]")}
              aria-hidden
            >
              <Sparkles
                className={cn(
                  "transition-all duration-200",
                  lg ? "h-5 w-5" : "h-4 w-4",
                  focused ? "text-accent-bright drop-shadow-[0_0_8px_rgba(157,143,255,0.7)]" : "text-fg-faint",
                )}
              />
            </div>

            {/* Text column — ghost overlay and textarea share the exact same
                box and typography, so baselines always align. */}
            <div className={cn("relative min-w-0 flex-1", lg ? "py-[15px]" : "py-[10px]")}>
              <GhostPlaceholder
                suggestions={SUGGESTIONS}
                visible={empty}
                className={cn(
                  lg ? "py-[15px] text-[18px] leading-[24px]" : "py-[10px] text-[15px] leading-[21px]",
                )}
              />
              <TextareaAutosize
                ref={taRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus={autoFocus}
                disabled={sending}
                minRows={1}
                maxRows={lg ? 8 : 5}
                spellCheck={false}
                aria-label="Describe what you want to build"
                aria-keyshortcuts="Enter Control+Enter Meta+Enter"
                className={cn(
                  "block w-full resize-none bg-transparent text-fg caret-accent-bright",
                  "placeholder:text-transparent focus:outline-none disabled:opacity-60",
                  "break-words [overflow-wrap:anywhere]",
                  lg ? "text-[18px] leading-[24px]" : "text-[15px] leading-[21px]",
                  // custom slim scrollbar once it overflows
                  "max-h-[220px] overflow-y-auto",
                )}
              />
            </div>

            {/* Launch */}
            <SendButton
              onClick={submit}
              loading={sending}
              disabled={false}
              size={lg ? 54 : 42}
            />
          </div>

          {/* Toolbar */}
          {lg && (
            <div className="flex items-center gap-2.5 border-t border-white/[0.05] px-6 py-2.5 text-2xs text-fg-faint">
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> build
              </span>
              <span className="text-fg-ghost">·</span>
              <span className="flex items-center gap-1.5">
                <Kbd>⇧↵</Kbd> new line
              </span>
              <span className="ml-auto hidden items-center gap-1.5 sm:flex">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors duration-300",
                    focused ? "bg-ok" : "bg-fg-ghost",
                  )}
                />
                an autonomous engineering team takes it from here
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
});
