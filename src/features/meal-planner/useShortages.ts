"use client";

import { useMemo } from "react";
import { projectShortages } from "@/lib/domain/stock";
import { useKitchen } from "@/lib/store/kitchen-store";

/** 예정 식단 전체를 날짜순으로 가상 소비했을 때의 재료 부족분 */
export function useShortages() {
  const { state } = useKitchen();
  return useMemo(() => projectShortages(state.meals, state.lots), [state.meals, state.lots]);
}
