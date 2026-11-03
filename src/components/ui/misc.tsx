import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[14px] border border-line bg-bg", className)}>{children}</div>;
}

export function Chip({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "missing"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12.5px] whitespace-nowrap",
        tone === "missing" ? "bg-danger-soft text-danger" : "bg-subtle text-[#3c433e]",
        className,
      )}
    >
      {tone === "default" && <i className="h-[5px] w-[5px] rounded-full bg-green" />}
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <p className="text-[16px] font-semibold">{title}</p>
      {description && <p className="mt-1.5 text-[14px] leading-relaxed text-sub">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "danger" }) {
  return (
    <div>
      <span className="block text-[12.5px] text-sub">{label}</span>
      <b className={cn("mt-0.5 block text-[16px] font-semibold", tone === "danger" && "text-danger")}>{value}</b>
    </div>
  );
}

/** 클라이언트 저장소 로딩 중 표시 */
export function ScreenSkeleton() {
  return (
    <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)]" aria-busy="true" aria-label="불러오는 중">
      <div className="h-4 w-28 rounded bg-subtle" />
      <div className="mt-2 h-8 w-20 rounded-lg bg-subtle" />
      <div className="mt-6 h-20 rounded-[14px] bg-subtle" />
      <div className="mt-4 h-44 rounded-[14px] bg-subtle" />
      <div className="mt-4 h-32 rounded-[14px] bg-subtle" />
    </div>
  );
}
