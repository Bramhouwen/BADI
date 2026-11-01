"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";

type Toast = { id: number; message: string; tone: "default" | "success" | "error" };

const ToastContext = React.createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((message: string, tone: Toast["tone"] = "default") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className={
                "pointer-events-auto rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-xl backdrop-blur " +
                (t.tone === "success"
                  ? "border-success/40 bg-[#102a1f]/95 text-success"
                  : t.tone === "error"
                    ? "border-danger/40 bg-[#2a1414]/95 text-danger"
                      : "border-white/20 bg-[#12293f]/95 text-text")
              }
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
