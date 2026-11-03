import { diffDays } from "@/lib/date";
import type { ExpirySource, InventoryLot, ISODate } from "./types";

/**
 * 기한 상태.
 * - confirmed-*: 포장 표기·사용자 입력으로 확인된 소비기한 기준
 * - recommended-*: 보관 권장 기한 기준 (참고용, 소비기한 아님)
 * - none: 둘 다 없음 — 추측하지 않는다.
 */
export type ExpiryTone = "danger" | "warn" | "ok" | "rec-over" | "rec" | "none";

export interface ExpiryInfo {
  tone: ExpiryTone;
  label: string;
  /** 정렬용. 작을수록 급함 */
  sortKey: number;
  days: number | null;
  kind: "confirmed" | "recommended" | "none";
}

export const EXPIRY_SOURCE_LABEL: Record<ExpirySource, string> = {
  label: "포장 표기",
  user: "직접 입력",
  ocr: "이미지에서 읽음",
};

export function lotExpiry(
  lot: Pick<InventoryLot, "expiryDate" | "recommendedUseBy">,
  today: ISODate,
  soonDays: number,
): ExpiryInfo {
  if (lot.expiryDate) {
    const d = diffDays(today, lot.expiryDate);
    if (d < 0) return { tone: "danger", label: `기한 ${-d}일 지남`, sortKey: d, days: d, kind: "confirmed" };
    if (d === 0) return { tone: "danger", label: "오늘까지", sortKey: 0, days: 0, kind: "confirmed" };
    return {
      tone: d <= soonDays ? "warn" : "ok",
      label: `D-${d}`,
      sortKey: d,
      days: d,
      kind: "confirmed",
    };
  }
  if (lot.recommendedUseBy) {
    const d = diffDays(today, lot.recommendedUseBy);
    // 권장기한은 확인된 소비기한보다 후순위로 정렬되도록 가중치를 준다
    if (d < 0) return { tone: "rec-over", label: `권장 +${-d}일`, sortKey: d + 0.5, days: d, kind: "recommended" };
    return { tone: "rec", label: d === 0 ? "권장 오늘" : `권장 D-${d}`, sortKey: d + 0.5, days: d, kind: "recommended" };
  }
  return { tone: "none", label: "기한 없음", sortKey: 10_000, days: null, kind: "none" };
}

/** 여러 로트 중 가장 급한 기한 */
export function earliestExpiry(
  lots: Pick<InventoryLot, "expiryDate" | "recommendedUseBy">[],
  today: ISODate,
  soonDays: number,
): ExpiryInfo {
  const infos = lots.map((l) => lotExpiry(l, today, soonDays));
  if (infos.length === 0) return { tone: "none", label: "기한 없음", sortKey: 10_000, days: null, kind: "none" };
  return infos.reduce((a, b) => (b.sortKey < a.sortKey ? b : a));
}

/** 임박 여부: 확인된 소비기한 D-n 이내 또는 권장기한 경과 */
export function isUrgent(info: ExpiryInfo, soonDays: number): boolean {
  if (info.kind === "confirmed") return info.days != null && info.days <= soonDays;
  if (info.kind === "recommended") return info.days != null && info.days < 0;
  return false;
}
