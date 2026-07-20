import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Eye, FileText, MonitorPlay, RefreshCw, Smartphone } from "lucide-react";
import { useRunStore, type VirtualFile } from "@/stores/runStore";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Preview — run generated HTML right inside the app (ChatGPT-canvas style).
 * Linked local css/js files are inlined so single-page apps "just work".
 * Rendered in a sandboxed iframe: scripts allowed, same-origin NOT allowed.
 */
export function PreviewPane() {
  const files = useRunStore((s) => s.files);
  const htmlFiles = useMemo(() => files.filter((f) => f.path.endsWith(".html")), [files]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mobile, setMobile] = useState(false);

  const active =
    htmlFiles.find((f) => f.path === selected) ?? htmlFiles[htmlFiles.length - 1] ?? null;

  const doc = useMemo(() => (active ? inlineAssets(active, files) : null), [active, files]);

  if (htmlFiles.length === 0) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <MonitorPlay className="mx-auto mb-3 h-7 w-7 text-fg-ghost" />
          <p className="text-sm text-fg-muted">Nothing to preview yet.</p>
          <p className="mt-1 max-w-xs text-xs text-fg-faint">
            The moment the build produces an HTML page, it will run right here — live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <Eye className="h-3.5 w-3.5 text-accent-cyan" />
        <select
          value={active?.path ?? ""}
          onChange={(e) => setSelected(e.target.value)}
          className="max-w-[50%] rounded-md border border-white/[0.08] bg-ink-800 px-2 py-1 font-mono text-2xs text-fg focus:outline-none"
        >
          {htmlFiles.map((f) => (
            <option key={f.path} value={f.path}>
              {f.path}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip label={mobile ? "Desktop view" : "Phone view"}>
            <button
              onClick={() => setMobile((m) => !m)}
              className={cn(
                "rounded p-1.5 transition-colors hover:bg-white/[0.06]",
                mobile ? "text-accent-bright" : "text-fg-faint hover:text-fg",
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Reload preview">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="rounded p-1.5 text-fg-faint transition-colors hover:bg-white/[0.06] hover:text-fg"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Open in new tab">
            <button
              onClick={() => {
                if (!doc) return;
                const blob = new Blob([doc], { type: "text/html" });
                window.open(URL.createObjectURL(blob), "_blank");
              }}
              className="rounded p-1.5 text-fg-faint transition-colors hover:bg-white/[0.06] hover:text-fg"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Viewport */}
      <div className="grid min-h-0 flex-1 place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(124,107,255,0.06),transparent_60%)] p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${active?.path}-${reloadKey}-${mobile}`}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className={cn(
              "overflow-hidden rounded-lg bg-white shadow-e3",
              mobile ? "h-full max-h-[640px] w-[340px]" : "h-full w-full",
            )}
          >
            {doc && (
              <iframe
                title="Generated app preview"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                srcDoc={doc}
                className="h-full w-full border-0"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="flex shrink-0 items-center gap-1.5 border-t border-white/[0.06] px-3 py-1.5 text-2xs text-fg-ghost">
        <FileText className="h-3 w-3" />
        Running in a sandbox — safe to click around. Your machine is untouched.
      </p>
    </div>
  );
}

/**
 * Inline `<link href="local.css">` and `<script src="local.js">` references
 * with sibling files from the run, so multi-file pages work inside srcDoc.
 */
function inlineAssets(html: VirtualFile, all: VirtualFile[]): string {
  const dir = html.path.includes("/") ? html.path.slice(0, html.path.lastIndexOf("/") + 1) : "";
  const lookup = (ref: string): VirtualFile | undefined => {
    const clean = ref.replace(/^\.\//, "").split(/[?#]/)[0];
    return (
      all.find((f) => f.path === dir + clean) ??
      all.find((f) => f.path === clean) ??
      all.find((f) => f.path.endsWith("/" + clean))
    );
  };

  let out = html.content;
  out = out.replace(
    /<link\b[^>]*href=["']([^"']+\.css)["'][^>]*\/?>(?:<\/link>)?/gi,
    (tag, href: string) => {
      const file = lookup(href);
      return file ? `<style>\n${file.content}\n</style>` : tag;
    },
  );
  out = out.replace(
    /<script\b[^>]*src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi,
    (tag, src: string) => {
      const file = lookup(src);
      return file ? `<script>\n${file.content}\n</script>` : tag;
    },
  );
  return out;
}
