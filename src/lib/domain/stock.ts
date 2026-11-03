import { earliestExpiry, type ExpiryInfo } from "./expiry";
import { fifoOrder } from "./costing";
import type { Ingredient, InventoryLot, ISODate, MealPlan, MealType, StorageLocation } from "./types";

export interface StockSummary {
  ingredient: Ingredient;
  lots: InventoryLot[];
  total: number;
  expiry: ExpiryInfo;
  lastAcquired: ISODate;
  /** 가중평균 단가 (가격 있는 로트 기준) */
  avgUnitCost: number | null;
}

export function activeLots(lots: InventoryLot[]): InventoryLot[] {
  return lots.filter((l) => l.status === "active" && l.qtyRemaining > 0);
}

export function stockOf(lots: InventoryLot[], ingredientId: string): number {
  return activeLots(lots)
    .filter((l) => l.ingredientId === ingredientId)
    .reduce((s, l) => s + l.qtyRemaining, 0);
}

export function summarizeStock(
  ingredients: Ingredient[],
  lots: InventoryLot[],
  today: ISODate,
  soonDays: number,
  location?: StorageLocation,
): StockSummary[] {
  const act = activeLots(lots).filter((l) => !location || l.storage === location);
  const result: StockSummary[] = [];
  for (const ing of ingredients) {
    const mine = act.filter((l) => l.ingredientId === ing.id).sort(fifoOrder);
    if (mine.length === 0) continue;
    const total = mine.reduce((s, l) => s + l.qtyRemaining, 0);
    const priced = mine.filter((l) => l.unitCost != null);
    const pricedQty = priced.reduce((s, l) => s + l.qtyRemaining, 0);
    result.push({
      ingredient: ing,
      lots: mine,
      total,
      expiry: earliestExpiry(mine, today, soonDays),
      lastAcquired: mine.reduce((m, l) => (l.acquiredOn > m ? l.acquiredOn : m), mine[0].acquiredOn),
      avgUnitCost: pricedQty > 0 ? priced.reduce((s, l) => s + l.qtyRemaining * (l.unitCost ?? 0), 0) / pricedQty : null,
    });
  }
  return result;
}

const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

export function compareMeals(a: MealPlan, b: MealPlan): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.mealType !== b.mealType) return MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];
  return a.createdAt - b.createdAt;
}

/**
 * 예정된 식단을 날짜순으로 가상 소비해 재료별 부족분을 계산한다.
 * 반환: mealId → ingredientId → 부족 수량
 */
export function projectShortages(meals: MealPlan[], lots: InventoryLot[]): Map<string, Map<string, number>> {
  const available = new Map<string, number>();
  for (const l of activeLots(lots)) available.set(l.ingredientId, (available.get(l.ingredientId) ?? 0) + l.qtyRemaining);
  const result = new Map<string, Map<string, number>>();
  const planned = meals.filter((m) => m.status === "planned").sort(compareMeals);
  for (const meal of planned) {
    const short = new Map<string, number>();
    for (const item of meal.items) {
      const have = available.get(item.ingredientId) ?? 0;
      const use = Math.min(have, item.plannedQuantity);
      available.set(item.ingredientId, have - use);
      const lack = item.plannedQuantity - use;
      if (lack > 1e-6) short.set(item.ingredientId, lack);
    }
    result.set(meal.id, short);
  }
  return result;
}
