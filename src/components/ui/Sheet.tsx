"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** 바텀 시트: 페이지 이동 없이 편집·확인을 처리한다 (한 손 조작). */
export function Sheet({ open, onClose, title, description, children, footer, className }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 animate-fade-in bg-ink/35"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute bottom-0 flex max-h-[88dvh] w-full max-w-[480px] animate-sheet-up flex-col rounded-t-[20px] bg-bg outline-none",
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong" />
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-3 pb-2">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[18px] font-bold tracking-[-0.01em]">
              {title}
            </h2>
            {description && <p className="mt-1 text-[13.5px] text-sub">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sub active:bg-subtle"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-bg px-5 pt-3 pb-safe">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  );
}
