import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { spring } from "@/lib/motion";

export interface Toast {
  id: number;
  tone: "info" | "success" | "error";
  title: string;
  detail?: string;
}

let toastSeq = 0;

interface ToastStore {
  toasts: Toast[];
  push(toast: Omit<Toast, "id">): void;
  dismiss(id: number): void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (t: Omit<Toast, "id">) => useToastStore.getState().push(t);

const icons = {
  info: <Info className="h-4 w-4 text-accent-cyan" />,
  success: <CheckCircle2 className="h-4 w-4 text-ok" />,
  error: <XCircle className="h-4 w-4 text-danger" />,
};

export function ToastViewport() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[90] flex w-80 flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.18 } }}
            transition={spring.element}
            onClick={() => dismiss(t.id)}
            className="glass-deep pointer-events-auto flex items-start gap-3 rounded-lg p-3.5 text-left"
          >
            <span className="mt-0.5">{icons[t.tone]}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-fg">{t.title}</span>
              {t.detail && (
                <span className="mt-0.5 block truncate text-xs text-fg-muted">{t.detail}</span>
              )}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
