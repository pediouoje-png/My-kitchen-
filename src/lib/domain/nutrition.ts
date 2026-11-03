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
