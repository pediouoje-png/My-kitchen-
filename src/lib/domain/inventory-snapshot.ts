import { diffDays, formatMD } from "@/lib/date";
import { fifoOrder } from "./costing";
import { EXPIRY_SOURCE_LABEL, isUrgent, lotExpiry, type ExpiryInfo } from "./expiry";
import { summarizeStock } from "./stock";
import type { ISODate, KitchenState, StorageLocation } from "./types";
import { formatQuantity, formatUnitPrice, STORAGE_LABEL, STORAGE_ORDER, unitLabel } from "./units";

/**
 * 현재 냉장고 재고 스냅샷 — 재료별 수량 · 보관 위치 · 소비기한.
 * 화면의 "재고 내보내기"에서 쓰고, DB 연결 후에는 서버 API(GET /api/inventory)와
 * Claude 연결(MCP)에서도 같은 함수를 그대로 쓴다.
 */

export interface SnapshotLot {
  quantity: number;
  quantityText: string;
  storage: StorageLocation;
  storageLabel: string;
  acquiredOn: ISODate;
  source: string | null;
  /** 포장 표기·직접 입력으로 확인된 소비기한만. 없으면 null (추정하지 않음) */
  expiryDate: ISODate | null;
  expirySource: string | null;
  /** 보관 권장 기한 (참고용, 소비기한 아님) */
  recommendedUseBy: ISODate | null;
  daysLeft: number | null;
  status: string;
  unitPriceText: string | null;
}

export interface SnapshotItem {
  name: string;
  category: string;
  unit: "g" | "ml" | "ea";
  unitLabel: string;
  totalQuantity: number;
  totalText: string;
  storages: StorageLocation[];
  /** 가장 급한 기한 */
  status: string;
  urgent: boolean;
  lots: SnapshotLot[];
}

export interface InventorySnapshot {
  generatedOn: ISODate;
  scope: { location: StorageLocation | "all"; category: string | null };
  soonDays: number;
  itemCount: number;
  items: SnapshotItem[];
}

/** 11/9 — 올해가 아니면 2027/1/17 처럼 연도를 붙인다 (AI가 날짜를 헷갈리지 않도록) */
function shortDate(date: ISODate, today: ISODate): string {
  return date.slice(0, 4) === today.slice(0, 4) ? formatMD(date) : `${date.slice(0, 4)}/${formatMD(date)}`;
}

function statusText(info: ExpiryInfo, date: ISODate | null, today: ISODate): string {
  if (info.kind === "none") return "기한 정보 없음";
  const d = date ? shortDate(date, today) : "";
  if (info.kind === "confirmed") {
    if (info.days != null && info.days < 0) return `소비기한 ${d} (${-info.days}일 지남)`;
    if (info.days === 0) return `소비기한 ${d} (오늘까지)`;
    return `소비기한 ${d} (D-${info.days})`;
  }
  if (info.days != null && info.days < 0) return `권장 기한 ${d} 지남`;
  return `권장 ${d}까지`;
}

export function getInventorySnapshot(
  state: KitchenState,
  today: ISODate,
  scope: { location?: StorageLocation | "all"; category?: string | null } = {},
): InventorySnapshot {
  const location = scope.location ?? "all";
  const soonDays = state.settings.soonDays;
  const stock = summarizeStock(state.ingredients, state.lots, today, soonDays, location === "all" ? undefined : location)
    .filter((s) => !scope.category || s.ingredient.category === scope.category)
    .sort((a, b) => a.expiry.sortKey - b.expiry.sortKey || a.ingredient.name.localeCompare(b.ingredient.name, "ko"));

  const items: SnapshotItem[] = stock.map((s) => {
    const ing = s.ingredient;
    const lots = [...s.lots].sort(fifoOrder).map((l): SnapshotLot => {
      const info = lotExpiry(l, today, soonDays);
      return {
        quantity: l.qtyRemaining,
        quantityText: formatQuantity(l.qtyRemaining, ing),
        storage: l.storage,
        storageLabel: STORAGE_LABEL[l.storage],
        acquiredOn: l.acquiredOn,
        source: l.sourceLabel,
        expiryDate: l.expiryDate,
        expirySource: l.expirySource ? EXPIRY_SOURCE_LABEL[l.expirySource] : null,
        recommendedUseBy: l.recommendedUseBy,
        daysLeft: info.days,
        status: statusText(info, l.expiryDate ?? l.recommendedUseBy, today),
        unitPriceText: l.unitCost == null ? null : formatUnitPrice(l.unitCost, ing),
      };
    });
    const first = s.lots.find((l) => lotExpiry(l, today, soonDays).sortKey === s.expiry.sortKey) ?? s.lots[0];
    return {
      name: ing.name,
      category: ing.category,
      unit: ing.baseUnit,
      unitLabel: unitLabel(ing),
      totalQuantity: s.total,
      totalText: formatQuantity(s.total, ing),
      storages: STORAGE_ORDER.filter((st) => s.lots.some((l) => l.storage === st)),
      status: statusText(s.expiry, first.expiryDate ?? first.recommendedUseBy, today),
      urgent: isUrgent(s.expiry, soonDays),
      lots,
    };
  });

  return { generatedOn: today, scope: { location, category: scope.category ?? null }, soonDays, itemCount: items.length, items };
}

// ---------------------------------------------------------------- 내보내기 형식

const AI_QUESTION =
  "이 재고로 소비기한이 가까운 재료부터 쓰는 3일치 식단(아침·점심·저녁)을 추천해 줘. 없는 재료는 최소한으로 하고, 사야 할 재료는 따로 정리해 줘.";

/** 사람과 AI가 읽기 좋은 텍스트 (보관 위치별로 묶음) */
export function snapshotToText(snap: InventorySnapshot, opts: { withQuestion?: boolean } = {}): string {
  const scopeText = [
    snap.scope.location === "all" ? null : STORAGE_LABEL[snap.scope.location],
    snap.scope.category,
  ]
    .filter(Boolean)
    .join(" · ");
  const lines: string[] = [
    `[내 냉장고 재고] ${snap.generatedOn} 기준${scopeText ? ` · ${scopeText}` : ""} · ${snap.itemCount}개 재료`,
    "(소비기한 = 포장에 적힌 날짜 / 권장 = 보관 권장 기한이며 소비기한 아님 / ⚠ = 빨리 써야 함)",
  ];
  for (const st of STORAGE_ORDER) {
    const rows = snap.items
      .map((it) => ({ it, lots: it.lots.filter((l) => l.storage === st) }))
      .filter((r) => r.lots.length > 0);
    if (rows.length === 0) continue;
    lines.push("", `■ ${STORAGE_LABEL[st]} (${rows.length})`);
    for (const { it, lots } of rows) {
      const qty = lots.reduce((s, l) => s + l.quantity, 0);
      const qtyText = lots.length === it.lots.length ? it.totalText : lotsQuantityText(it, qty);
      const urgent = lots.some((l) => l.daysLeft != null && (l.expiryDate ? l.daysLeft <= snap.soonDays : l.daysLeft < 0));
      const expiries = lots.map((l) => l.status);
      const unique = [...new Set(expiries)];
      lines.push(
        `- ${it.name} ${qtyText}${lots.length > 1 ? ` (${lots.length}건)` : ""} · ${unique.join(", ")}${urgent ? " ⚠" : ""}`,
      );
    }
  }
  if (snap.itemCount === 0) lines.push("", "(재고 없음)");
  if (opts.withQuestion) lines.push("", AI_QUESTION);
  return lines.join("\n");
}

function lotsQuantityText(it: SnapshotItem, qty: number): string {
  return formatQuantity(qty, { baseUnit: it.unit, eaLabel: it.unit === "ea" ? it.unitLabel : undefined });
}

export function snapshotToJSON(snap: InventorySnapshot): string {
  return JSON.stringify(snap, null, 2);
}

/** 엑셀용 CSV — 구매 건(로트)마다 한 줄. 한글이 깨지지 않도록 BOM을 붙인다 */
export function snapshotToCSV(snap: InventorySnapshot): string {
  const header = ["이름", "분류", "보관", "수량", "단위", "구매일", "구매처", "소비기한", "소비기한 출처", "보관 권장 기한", "남은 일수", "단위 가격"];
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = snap.items.flatMap((it) =>
    it.lots.map((l) =>
      [
        it.name,
        it.category,
        l.storageLabel,
        Number(l.quantity.toFixed(3)),
        it.unitLabel,
        l.acquiredOn,
        l.source ?? "직접 등록",
        l.expiryDate,
        l.expirySource,
        l.recommendedUseBy,
        l.expiryDate || l.recommendedUseBy ? diffDays(snap.generatedOn, (l.expiryDate ?? l.recommendedUseBy)!) : null,
        l.unitPriceText,
      ]
        .map(esc)
        .join(","),
    ),
  );
  return "﻿" + [header.join(","), ...rows].join("\n");
}
