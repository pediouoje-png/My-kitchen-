"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function PageHeader({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-[14px] font-medium text-sub">{eyebrow}</p>}
        <h1 className="mt-0.5 text-[28px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
      </div>
      {right && <div className="-mr-2 flex shrink-0 items-center">{right}</div>}
    </header>
  );
}

/** 상세 화면 헤더: 뒤로 가기 (히스토리가 없으면 fallback 경로로 이동) */
export function DetailHeader({ title, fallbackHref, right }: { title: string; fallbackHref: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex h-[calc(env(safe-area-inset-top)+3.5rem)] items-end bg-bg/95 px-2 pt-safe pb-1.5 backdrop-blur">
      <button
        type="button"
        aria-label="뒤로"
        onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
      >
        <ChevronLeft size={24} strokeWidth={1.75} />
      </button>
      <h1 className="flex-1 truncate pb-2.5 text-center text-[17px] font-semibold">{title}</h1>
      <div className="flex h-11 min-w-11 items-center justify-end">{right}</div>
    </header>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {right}
    </div>
  );
}
