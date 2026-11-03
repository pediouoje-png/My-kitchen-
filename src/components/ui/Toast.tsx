"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastData {
  id: number;
  message: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

const ToastContext = createContext<(message: string, action?: ToastData["action"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, action?: ToastData["action"]) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, action });
    timer.current = setTimeout(() => setToast(null), action ? 4500 : 2600);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-[448px] animate-toast-in items-center gap-3 rounded-[14px] bg-ink px-4 py-3 text-[14.5px] text-white shadow-lg"
          >
            <span className="flex-1">{toast.message}</span>
            {toast.action &&
              (toast.action.href ? (
                <Link
                  href={toast.action.href}
                  onClick={() => setToast(null)}
                  className="shrink-0 font-semibold text-[#9fd0ab]"
                >
                  {toast.action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick?.();
                    setToast(null);
                  }}
                  className="shrink-0 font-semibold text-[#9fd0ab]"
                >
                  {toast.action.label}
                </button>
              ))}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
