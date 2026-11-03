import type { BaseUnit, Ingredient, StorageLocation } from "./types";

export const STORAGE_LABEL: Record<StorageLocation, string> = {
  fridge: "냉장",
  freezer: "냉동",
  pantry: "실온",
};

export const STORAGE_ORDER: StorageLocation[] = ["fridge", "freezer", "pantry"];

function trimNumber(n: number, digits = 1): string {
  const fixed = Number(n.toFixed(digits));
  return fixed.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

/** 기준 단위 수량을 사람이 읽기 쉬운 문자열로 변환 */
export function formatQuantity(qty: number, ingredient: Pick<Ingredient, "baseUnit" | "eaLabel">): string {
  const unit = ingredient.baseUnit;
  if (unit === "g") {
    if (qty >= 1000) return `${trimNumber(qty / 1000, 2)}kg`;
    return `${trimNumber(qty, 0)}g`;
  }
  if (unit === "ml") {
    if (qty >= 10000) return `${trimNumber(qty / 1000, 1)}L`;
    return `${trimNumber(qty, 0)}ml`;
  }
  return `${formatEa(qty)}${ingredient.eaLabel ?? "개"}`;
}

/** 0.5 → 1/2, 1.5 → 1 1/2 처럼 요리에서 쓰는 분수 표현 */
export function formatEa(qty: number): string {
  const whole = Math.floor(qty + 1e-9);
  const frac = qty - whole;
  const fracs: [number, string][] = [
    [0.25, "1/4"],
    [1 / 3, "1/3"],
    [0.5, "1/2"],
    [2 / 3, "2/3"],
    [0.75, "3/4"],
  ];
  const match = fracs.find(([v]) => Math.abs(frac - v) < 0.02);
  if (frac < 0.02) return String(whole);
  if (match) return whole > 0 ? `${whole} ${match[1]}` : match[1];
  return trimNumber(qty, 1);
}

/** 입력 단계 (스테퍼 증감 폭) */
export function quantityStep(unit: BaseUnit): number {
  if (unit === "ea") return 0.5;
  return 10;
}

/** 단위 가격 표시: 100g당 660원, 1개당 287원 */
export function formatUnitPrice(unitCost: number | null, ingredient: Pick<Ingredient, "baseUnit" | "eaLabel">): string {
  if (unitCost == null) return "가격 정보 없음";
  if (ingredient.baseUnit === "ea") {
    return `1${ingredient.eaLabel ?? "개"}당 ${formatWon(unitCost)}`;
  }
  return `100${ingredient.baseUnit}당 ${formatWon(unitCost * 100)}`;
}

export function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export function unitLabel(ingredient: Pick<Ingredient, "baseUnit" | "eaLabel">): string {
  return ingredient.baseUnit === "ea" ? (ingredient.eaLabel ?? "개") : ingredient.baseUnit;
}
