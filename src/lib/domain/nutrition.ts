import type { Ingredient } from "./types";

export interface NutritionTotal {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** 영양 정보가 없어 합계에서 제외된 재료 수 (0으로 취급하지 않는다) */
  missing: number;
}

/** 기준 단위 수량에 대한 영양값. 계산 불가 시 null */
export function nutritionFor(ingredient: Ingredient, quantity: number): Omit<NutritionTotal, "missing"> | null {
  const n = ingredient.nutrition;
  if (!n) return null;
  let factor: number | null = null;
  if (n.basis === "per_ea") {
    factor = ingredient.baseUnit === "ea" ? quantity : ingredient.gramsPerEa ? quantity / ingredient.gramsPerEa : null;
  } else if (ingredient.baseUnit === "ea") {
    factor = ingredient.gramsPerEa ? (quantity * ingredient.gramsPerEa) / 100 : null;
  } else {
    factor = quantity / 100;
  }
  if (factor == null) return null;
  return {
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    fat: n.fat * factor,
    carbs: n.carbs * factor,
  };
}

export type Macro = "carbs" | "protein" | "fat";

export const MACRO_LABEL: Record<Macro, string> = { carbs: "탄수화물", protein: "단백질", fat: "지방" };
export const MACRO_SHORT: Record<Macro, string> = { carbs: "탄", protein: "단", fat: "지" };
export const MACRO_ORDER: Macro[] = ["carbs", "protein", "fat"];
/** g당 열량 */
export const MACRO_KCAL: Record<Macro, number> = { carbs: 4, protein: 4, fat: 9 };

/**
 * "풍부함" 기준 (100g 기준 함량). 화면에도 같은 기준을 안내한다.
 * 비율만 쓰면 열량이 아주 낮은 채소가 "단백질 풍부"로 잘못 분류되므로 절대량을 쓴다.
 */
export const RICH_THRESHOLD: Record<Macro, number> = { carbs: 15, protein: 8, fat: 8 };

/** 100g(또는 100ml) 기준 영양값. 환산할 수 없으면 null */
export function per100(ingredient: Ingredient): Record<Macro, number> | null {
  const n = ingredient.nutrition;
  if (!n) return null;
  if (n.basis !== "per_ea") return { carbs: n.carbs, protein: n.protein, fat: n.fat };
  if (!ingredient.gramsPerEa) return null;
  const f = 100 / ingredient.gramsPerEa;
  return { carbs: n.carbs * f, protein: n.protein * f, fat: n.fat * f };
}

/** 이 재료가 풍부한 영양소 (함량 큰 순). 영양 정보가 없으면 null */
export function richMacros(ingredient: Ingredient): Macro[] | null {
  const v = per100(ingredient);
  if (!v) return null;
  return MACRO_ORDER.filter((m) => v[m] >= RICH_THRESHOLD[m]).sort(
    (a, b) => v[b] / RICH_THRESHOLD[b] - v[a] / RICH_THRESHOLD[a],
  );
}

export function sumNutrition(
  ingredients: Ingredient[],
  needs: { ingredientId: string | null; quantity: number | null }[],
): NutritionTotal {
  const total: NutritionTotal = { kcal: 0, protein: 0, fat: 0, carbs: 0, missing: 0 };
  for (const need of needs) {
    const ing = need.ingredientId ? ingredients.find((i) => i.id === need.ingredientId) : undefined;
    if (!ing || need.quantity == null) {
      if (need.quantity != null) total.missing += 1;
      continue;
    }
    const v = nutritionFor(ing, need.quantity);
    if (!v) {
      total.missing += 1;
      continue;
    }
    total.kcal += v.kcal;
    total.protein += v.protein;
    total.fat += v.fat;
    total.carbs += v.carbs;
  }
  return total;
}

export interface StockComposition {
  /** 보유 재고 전체의 영양소 총량 (g) */
  grams: Record<Macro, number>;
  /** 열량 기준 비율 (0~1) */
  share: Record<Macro, number>;
  /** 영양소별로 많이 가진 재료 (보유량 × 함량 순) */
  top: Record<Macro, { ingredient: Ingredient; grams: number }[]>;
  /** 영양 정보가 없어 제외된 재료 */
  missing: Ingredient[];
}

/** 현재 보유 재고의 탄·단·지 구성 */
export function stockComposition(stock: { ingredient: Ingredient; total: number }[]): StockComposition {
  const grams: Record<Macro, number> = { carbs: 0, protein: 0, fat: 0 };
  const per: Record<Macro, { ingredient: Ingredient; grams: number }[]> = { carbs: [], protein: [], fat: [] };
  const missing: Ingredient[] = [];
  for (const { ingredient, total } of stock) {
    const v = nutritionFor(ingredient, total);
    if (!v) {
      missing.push(ingredient);
      continue;
    }
    const rich = richMacros(ingredient) ?? [];
    for (const m of MACRO_ORDER) {
      grams[m] += v[m];
      if (rich.includes(m)) per[m].push({ ingredient, grams: v[m] });
    }
  }
  const kcal = MACRO_ORDER.reduce((s, m) => s + grams[m] * MACRO_KCAL[m], 0);
  const share = Object.fromEntries(MACRO_ORDER.map((m) => [m, kcal > 0 ? (grams[m] * MACRO_KCAL[m]) / kcal : 0])) as Record<Macro, number>;
  for (const m of MACRO_ORDER) per[m].sort((a, b) => b.grams - a.grams);
  return { grams, share, top: per, missing };
}
