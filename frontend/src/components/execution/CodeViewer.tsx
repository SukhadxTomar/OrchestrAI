import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, FileCode2, FileText, FolderOpen, X } from "lucide-react";
import { useRunStore, type VirtualFile } from "@/stores/runStore";
import { cn } from "@/lib/utils";

/**
 * Code viewer: file tree (files appear as the agents write them) + Monaco
 * with tabs. New files auto-open so the user watches code typing itself.
 */
export function CodeViewer() {
  const files = useRunStore((s) => s.files);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Follow the newest file automatically.
  useEffect(() => {
    if (files.length === 0) return;
    const newest = files.reduce((a, b) => (a.writtenAt > b.writtenAt ? a : b));
    setOpenTabs((tabs) => (tabs.includes(newest.path) ? tabs : [...tabs, newest.path].slice(-6)));
    setActive(newest.path);
  }, [files]);

  const activeFile = useMemo(() => files.find((f) => f.path === active) ?? null, [files, active]);

  const tree = useMemo(() => buildTree(files), [files]);

  const closeTab = (path: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== path);
      if (active === path) setActive(next[next.length - 1] ?? null);
      return next;
    });
  };

  if (files.length === 0) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <FileCode2 className="mx-auto mb-3 h-7 w-7 text-fg-ghost" />
          <p className="text-sm text-fg-muted">No files yet.</p>
          <p className="mt-1 text-xs text-fg-faint">
            Generated code will appear here the moment the Coder starts writing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Tree */}
      <div className="w-52 shrink-0 overflow-y-auto border-r border-white/[0.06] p-2">
        <TreeLevel
          nodes={tree}
          depth={0}
          collapsed={collapsed}
          onToggle={(p) =>
            setCollapsed((prev) => {
              const next = new Set(prev);
              if (next.has(p)) next.delete(p);
              else next.add(p);
              return next;
            })
          }
          active={active}
          onOpen={(path) => {
            setOpenTabs((tabs) => (tabs.includes(path) ? tabs : [...tabs, path].slice(-6)));
            setActive(path);
          }}
        />
      </div>

      {/* Tabs + editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-white/[0.06] px-1 pt-1">
          <AnimatePresence initial={false}>
            {openTabs.map((path) => (
              <motion.button
                key={path}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setActive(path)}
                className={cn(
                  "group flex shrink-0 items-center gap-1.5 rounded-t-md px-3 py-1.5 font-mono text-2xs transition-colors",
                  active === path
                    ? "bg-white/[0.06] text-fg shadow-[inset_0_2px_0_#7c6bff]"
                    : "text-fg-faint hover:bg-white/[0.03] hover:text-fg-muted",
                )}
              >
                {path.split("/").pop()}
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(path);
                  }}
                  className="rounded p-0.5 opacity-0 transition-opacity hover:bg-white/[0.08] group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        <div className="min-h-0 flex-1">
          {activeFile ? (
            activeFile.language === "markdown" ? (
              <MarkdownPane file={activeFile} />
            ) : (
              <Editor
                path={activeFile.path}
                language={activeFile.language}
                value={activeFile.content}
                theme="orchestrai"
                beforeMount={(monaco) => {
                  monaco.editor.defineTheme("orchestrai", {
                    base: "vs-dark",
                    inherit: true,
                    rules: [
                      { token: "comment", foreground: "6b6980", fontStyle: "italic" },
                      { token: "keyword", foreground: "9d8fff" },
                      { token: "string", foreground: "7ee0a3" },
                      { token: "number", foreground: "4cc9f0" },
                      { token: "type", foreground: "82d9f5" },
                    ],
                    colors: {
                      "editor.background": "#00000000",
                      "editor.lineHighlightBackground": "#ffffff08",
                      "editorLineNumber.foreground": "#454356",
                      "editorIndentGuide.background": "#ffffff0a",
                      "minimap.background": "#00000000",
                    },
                  });
                }}
                options={{
                  readOnly: true,
                  minimap: { enabled: true, renderCharacters: false },
                  fontSize: 12.5,
                  fontFamily: '"JetBrains Mono", monospace',
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "all",
                  smoothScrolling: true,
                  padding: { top: 12 },
                  overviewRulerBorder: false,
                  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                }}
              />
            )
          ) : (
            <div className="grid h-full place-items-center text-sm text-fg-faint">
              Select a file
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── markdown viewer (for README.md) ─────────────────────────────────── */

function MarkdownPane({ file }: { file: VirtualFile }) {
  // A deliberate, tiny renderer — headings, code, tables, lists, quotes —
  // enough for READMEs without a dependency.
  const html = useMemo(() => renderMarkdown(file.content), [file.content]);
  return (
    <div
      className="prose-orchestrai h-full overflow-y-auto px-6 py-5 text-sm leading-relaxed text-fg-muted"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[12px] text-accent-bright">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-fg">$1</strong>');
}

function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let tableBuf: string[] = [];

  const flushTable = () => {
    if (!tableBuf.length) return;
    const rows = tableBuf.filter((r) => !/^\s*\|[\s|:-]+\|\s*$/.test(r));
    const cells = (r: string) => r.split("|").slice(1, -1).map((c) => c.trim());
    const [head, ...body] = rows;
    out.push('<table class="my-3 w-full text-left text-xs"><thead><tr>');
    cells(head).forEach((c) => out.push(`<th class="border-b border-white/10 py-1.5 pr-4 font-medium text-fg">${inline(c)}</th>`));
    out.push("</tr></thead><tbody>");
    body.forEach((r) => {
      out.push("<tr>");
      cells(r).forEach((c) => out.push(`<td class="border-b border-white/[0.05] py-1.5 pr-4">${inline(c)}</td>`));
      out.push("</tr>");
    });
    out.push("</tbody></table>");
    tableBuf = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushTable();
      out.push(inCode ? "</code></pre>" : '<pre class="my-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-[12px] leading-5 text-fg"><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(esc(line) + "\n");
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      tableBuf.push(line);
      continue;
    }
    flushTable();
    if (/^# /.test(line)) out.push(`<h1 class="mb-3 mt-1 text-lg font-semibold text-fg">${inline(line.slice(2))}</h1>`);
    else if (/^## /.test(line)) out.push(`<h2 class="mb-2 mt-5 text-base font-medium text-fg">${inline(line.slice(3))}</h2>`);
    else if (/^### /.test(line)) out.push(`<h3 class="mb-1.5 mt-4 text-sm font-medium text-fg">${inline(line.slice(4))}</h3>`);
    else if (/^> /.test(line)) out.push(`<blockquote class="my-2 border-l-2 border-accent/50 pl-3 italic text-fg-faint">${inline(line.slice(2))}</blockquote>`);
    else if (/^[-*] /.test(line)) out.push(`<li class="ml-4 list-disc">${inline(line.slice(2))}</li>`);
    else if (line.trim() === "") out.push('<div class="h-2"></div>');
    else out.push(`<p class="my-1.5">${inline(line)}</p>`);
  }
  flushTable();
  if (inCode) out.push("</code></pre>");
  return out.join("");
}

/* ── file tree ───────────────────────────────────────────────────────── */

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  file?: VirtualFile;
}

function buildTree(files: VirtualFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/");
    let level = root;
    let prefix = "";
    parts.forEach((part, i) => {
      prefix = prefix ? `${prefix}/${part}` : part;
      const isLeaf = i === parts.length - 1;
      let node = level.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: prefix, children: isLeaf ? undefined : [] };
        if (isLeaf) node.file = file;
        level.push(node);
      }
      if (!isLeaf) level = node.children!;
    });
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name));
    nodes.forEach((n) => n.children && sort(n.children));
  };
  sort(root);
  return root;
}

function TreeLevel({
  nodes,
  depth,
  collapsed,
  onToggle,
  active,
  onOpen,
}: {
  nodes: TreeNode[];
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  active: string | null;
  onOpen: (path: string) => void;
}) {
  return (
    <ul>
      <AnimatePresence initial={false}>
        {nodes.map((node) => (
          <motion.li
            key={node.path}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {node.file ? (
              <button
                onClick={() => onOpen(node.path)}
                style={{ paddingLeft: 8 + depth * 12 }}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left font-mono text-2xs transition-colors",
                  active === node.path
                    ? "bg-accent/15 text-fg"
                    : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
                )}
              >
                {node.name.endsWith(".md") ? (
                  <FileText className="h-3 w-3 shrink-0 text-accent-cyan/80" />
                ) : (
                  <FileCode2 className="h-3 w-3 shrink-0 text-accent-bright/80" />
                )}
                <span className="truncate">{node.name}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => onToggle(node.path)}
                  style={{ paddingLeft: 8 + depth * 12 }}
                  className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left font-mono text-2xs text-fg-faint transition-colors hover:bg-white/[0.04] hover:text-fg-muted"
                >
                  {collapsed.has(node.path) ? (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  )}
                  <FolderOpen className="h-3 w-3 shrink-0 text-warn/70" />
                  <span className="truncate">{node.name}</span>
                </button>
                <AnimatePresence initial={false}>
                  {!collapsed.has(node.path) && node.children && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <TreeLevel
                        nodes={node.children}
                        depth={depth + 1}
                        collapsed={collapsed}
                        onToggle={onToggle}
                        active={active}
                        onOpen={onOpen}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
