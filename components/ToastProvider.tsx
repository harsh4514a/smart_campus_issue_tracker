"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "info" | "success" | "error";

type Toast = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: { title?: string; message: string; variant?: ToastVariant; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback<ToastContextValue["showToast"]>(
    ({ title, message, variant = "info", durationMs = 3000 }) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, title, message, variant }]);
      window.setTimeout(() => removeToast(id), durationMs);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
  <div className="pointer-events-none fixed top-4 right-4 z-9999 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur bg-white/90 border-gray-200 text-gray-900 transition-all ${
              toast.variant === "success"
                ? "border-green-200 bg-green-50/90 text-green-900"
                : toast.variant === "error"
                  ? "border-red-200 bg-red-50/90 text-red-900"
                  : ""
            }`}
          >
            {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
            <p className="text-sm leading-relaxed">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
