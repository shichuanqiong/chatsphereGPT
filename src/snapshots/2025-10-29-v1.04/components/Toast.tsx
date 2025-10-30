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
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-center pt-[200px]">
          <div className="flex w-full max-w-2xl flex-col gap-3 px-4">
            {list.map((t) => (
              <div
                key={t.id}
                className="pointer-events-auto rounded-2xl px-5 py-4 text-sm shadow-lg bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/40 backdrop-blur-md animate-[toastIn_.18s_ease-out]"
              >
                {t.text.split('\n').map((line, idx) => (
                  <p key={idx} className="mb-1 last:mb-0 leading-relaxed text-center">
                    {line}
                  </p>
                ))}
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


