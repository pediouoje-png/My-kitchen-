import { isSameMonth } from "@/lib/date";
import { estimateCost } from "@/lib/domain/costing";
import { sumNutrition } from "@/lib/domain/nutrition";
import { compareMeals } from "@/lib/domain/stock";
import type { ISODate, KitchenState, MealPlan, MealType, Recipe } from "@/lib/domain/types";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];
export const MEAL_LABEL: Record<MealType, string> = { breakfast: "아침", lunch: "점심", dinner: "저녁" };

export function ingredientById(state: KitchenState, id: string | null | undefined) {
  return id ? state.ingredients.find((i) => i.id === id) : undefined;
}

export function mealsOn(state: KitchenState, date: ISODate, type?: MealType): MealPlan[] {
  return state.meals.filter((m) => m.date === date && (!type || m.mealType === type)).sort(compareMeals);
}

/** 완료된 식사는 실제 원가, 예정 식사는 FIFO 기준 예상 원가 */
export function mealCost(state: KitchenState, meal: MealPlan) {
  if (meal.status === "done") return { total: meal.actualCost ?? 0, estimated: false, unknownCount: 0, actual: true };
  const est = estimateCost(
    state.lots,
    meal.items.map((i) => ({ ingredientId: i.ingredientId, quantity: i.plannedQuantity })),
  );
  return { ...est, actual: false };
}

export function scaledRecipeNeeds(recipe: Recipe, servings: number) {
  const ratio = servings / recipe.servings;
  return recipe.ingredients.map((ri) => ({
    ...ri,
    quantity: ri.quantity == null ? null : Number((ri.quantity * ratio).toFixed(3)),
  }));
}

export function recipeCost(state: KitchenState, recipe: Recipe, servings: number) {
  return estimateCost(state.lots, scaledRecipeNeeds(recipe, servings).filter((n) => !n.optional));
}

export function recipeNutrition(state: KitchenState, recipe: Recipe, servings: number) {
  const total = sumNutrition(state.ingredients, scaledRecipeNeeds(recipe, servings).filter((n) => !n.optional));
  const per = 1 / servings;
  return { kcal: total.kcal * per, protein: total.protein * per, fat: total.fat * per, carbs: total.carbs * per, missing: total.missing };
}

export function monthlySpend(state: KitchenState, today: ISODate) {
  let food = 0;
  let waste = 0;
  for (const l of state.logs) {
    if (!isSameMonth(l.consumedOn, today)) continue;
    if (l.reason === "discard") waste += l.cost;
    else food += l.cost; // meal, manual, adjust(역분개 음수 포함)
  }
  return { food, waste };
}
