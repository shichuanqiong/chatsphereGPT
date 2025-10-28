import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "info" | "warning" | "error";
type ToastItem = { id: number; text: string; variant: ToastVariant; ms: number };

type Ctx = {
  show: (text: string, variant?: ToastVariant, ms?: number) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider/>");
  return ctx;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [list, setList] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const show = useCallback((text: string, variant: ToastVariant = "info", ms = 1000) => {
    const id = idRef.current++;
    setList((prev) => [...prev, { id, text, variant, ms }]);
    window.setTimeout(() => {
      setList((prev) => prev.filter((t) => t.id !== id));
    }, ms);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-center p-4">
          <div className="mt-4 flex w-full max-w-md flex-col gap-2">
            {list.map((t) => (
              <div
                key={t.id}
                className={[
                  "pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-lg ring-1/5 backdrop-blur-sm",
                  "animate-[toastIn_.18s_ease-out]",
                  t.variant === "success" && "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
                  t.variant === "info"    && "bg-sky-500/15     text-sky-200     ring-sky-500/30",
                  t.variant === "warning" && "bg-amber-500/15   text-amber-200   ring-amber-500/30",
                  t.variant === "error"   && "bg-rose-500/15    text-rose-200    ring-rose-500/30",
                ].filter(Boolean).join(" ")}
                style={{ border: "1px solid var(--tw-ring-color)" }}
              >
                {t.text}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastCtx.Provider>
  );
};


