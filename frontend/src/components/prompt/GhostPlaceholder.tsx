import { memo, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * GhostPlaceholder — the rotating "type-ahead" suggestion, fully isolated.
 *
 * Why a separate memoized component: the typewriter ticks every ~50ms.
 * If that state lived in the composer, every tick would re-render the
 * textarea and fight the caret. Here the animation re-renders only this
 * overlay; the textarea never notices.
 */
export const GhostPlaceholder = memo(function GhostPlaceholder({
  suggestions,
  visible,
  className,
}: {
  suggestions: string[];
  visible: boolean;
  className?: string;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    let si = 0;
    let ci = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!alive) return;
      const target = suggestions[si];
      if (!deleting) {
        ci++;
        if (ci >= target.length + 16) deleting = true; // hold, then erase
      } else {
        ci -= 2; // erase faster than we type — feels deliberate
        if (ci <= 0) {
          ci = 0;
          deleting = false;
          si = (si + 1) % suggestions.length;
        }
      }
      setText(target.slice(0, Math.min(ci, target.length)));
      timer = setTimeout(tick, deleting ? 18 : ci > target.length ? 110 : 55);
    };
    timer = setTimeout(tick, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [visible, suggestions]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 select-none overflow-hidden",
        "font-medium text-fg-faint",
        className,
      )}
    >
      <span className="align-baseline">{text}</span>
      <span className="ml-px inline-block w-[2px] animate-blink rounded-full bg-accent-bright align-baseline">
        &#8203;
      </span>
    </div>
  );
});
