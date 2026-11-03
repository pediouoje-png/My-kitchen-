"use client";

import type { ReactNode } from "react";
import { ScreenSkeleton } from "@/components/ui/misc";
import { useKitchen } from "@/lib/store/kitchen-store";

/**
 * 목업 데이터는 브라우저에서 "오늘" 날짜와 localStorage를 읽은 뒤에 확정된다.
 * 그 전에는 스켈레톤을 보여 서버 프리렌더 HTML과의 불일치를 피한다.
 */
export function ClientReady({ children }: { children: ReactNode }) {
  const { ready } = useKitchen();
  if (!ready) return <ScreenSkeleton />;
  return <>{children}</>;
}
