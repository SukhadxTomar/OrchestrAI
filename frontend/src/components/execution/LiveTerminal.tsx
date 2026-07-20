import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Download, Pause, Play } from "lucide-react";
import { useRunStore } from "@/stores/runStore";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Live terminal: real xterm.js with ANSI colors, auto-scroll (pausable),
 * and log download. Subscribes to the store's terminal lines directly to
 * avoid re-rendering React for every write.
 */
export function LiveTerminal() {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const writtenRef = useRef(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const autoScrollRef = useRef(true);
  autoScrollRef.current = autoScroll;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new XTerm({
      convertEol: true,
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 12.5,
      lineHeight: 1.5,
      cursorBlink: false,
      disableStdin: true,
      scrollback: 5000,
      theme: {
        background: "#00000000",
        foreground: "#c9c7d8",
        black: "#1c1c2a",
        blue: "#6ab0f3",
        cyan: "#4cc9f0",
        green: "#34d399",
        magenta: "#9d8fff",
        red: "#f87171",
        yellow: "#fbbf24",
        white: "#ecebf5",
        brightBlack: "#454356",
        selectionBackground: "#7c6bff55",
      },
      allowTransparency: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    termRef.current = term;

    // Replay whatever already exists, then subscribe for the delta.
    const write = () => {
      const lines = useRunStore.getState().terminal;
      for (; writtenRef.current < lines.length; writtenRef.current++) {
        term.writeln(lines[writtenRef.current].text);
      }
      if (autoScrollRef.current) term.scrollToBottom();
    };
    write();
    const unsub = useRunStore.subscribe(write);

    const ro = new ResizeObserver(() => fit.fit());
    ro.observe(host);

    return () => {
      unsub();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      writtenRef.current = 0;
    };
  }, []);

  const download = () => {
    const raw = useRunStore
      .getState()
      // eslint-disable-next-line no-control-regex
      .terminal.map((l) => l.text.replace(/\x1b\[[0-9;]*m/g, ""))
      .join("\n");
    const blob = new Blob([raw], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orchestrai-${useRunStore.getState().runId ?? "run"}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div data-terminal className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-ok/80" />
        <span className="ml-2 font-mono text-2xs text-fg-faint">sandbox — live output</span>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip label={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}>
            <button
              onClick={() => setAutoScroll((v) => !v)}
              className="rounded p-1.5 text-fg-faint transition-colors hover:bg-white/[0.06] hover:text-fg"
            >
              {autoScroll ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </Tooltip>
          <Tooltip label="Download logs">
            <button
              onClick={download}
              className="rounded p-1.5 text-fg-faint transition-colors hover:bg-white/[0.06] hover:text-fg"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 p-2 [&_.xterm-viewport]:!bg-transparent" />
    </div>
  );
}
