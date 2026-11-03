import { uid, type NewMeal } from "@/lib/store/reducer";
import { scaledRecipeNeeds } from "@/lib/store/selectors";
import type { ISODate, MealPlan, MealType, Recipe } from "@/lib/domain/types";

/** 레시피 → 식단 1건 (재료는 인분 비율로 환산, 수량 미정·선택 재료는 제외) */
export function mealFromRecipe(
  recipe: Recipe,
  date: ISODate,
  mealType: MealType,
  servings: number,
  source: MealPlan["source"] = recipe.source === "ai" ? "ai" : "recipe",
): NewMeal {
  return {
    id: uid("meal"),
    date,
    mealType,
    title: recipe.title,
    recipeId: recipe.id,
    source,
    servings,
    items: scaledRecipeNeeds(recipe, servings)
      .filter((n) => n.ingredientId && n.quantity != null && !n.optional)
      .map((n) => ({ id: uid("mi"), ingredientId: n.ingredientId!, plannedQuantity: n.quantity! })),
  };
}

export const SOURCE_LABEL: Record<MealPlan["source"], string> = {
  recipe: "저장 레시피",
  ai: "AI 추천",
  manual: "직접 입력",
};
