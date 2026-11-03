import { formatQuantity } from "@/lib/domain/units";
import type { Ingredient, Recipe } from "@/lib/domain/types";
import { uid } from "@/lib/store/reducer";

/** 직접 입력한 메뉴(이름 + 재료) → 내 레시피 */
export function recipeFromItems(
  title: string,
  items: { ingredientId: string; plannedQuantity: number }[],
  servings: number,
  ingredients: Ingredient[],
): Recipe {
  return {
    id: uid("r"),
    title,
    description: "",
    source: "user",
    servings: Math.max(1, Math.round(servings)),
    cookMinutes: 0,
    steps: [],
    tags: ["직접 입력"],
    saved: true,
    ingredients: items.flatMap((i) => {
      const ing = ingredients.find((x) => x.id === i.ingredientId);
      if (!ing) return [];
      return [
        {
          ingredientId: ing.id,
          name: ing.name,
          quantity: i.plannedQuantity,
          displayText: `${ing.name} ${formatQuantity(i.plannedQuantity, ing)}`,
        },
      ];
    }),
  };
}

/** 같은 이름의 내 레시피가 이미 있으면 그것을 쓴다 (중복 저장 방지) */
export function findUserRecipe(recipes: Recipe[], title: string): Recipe | undefined {
  const t = title.trim();
  return recipes.find((r) => r.source === "user" && r.title.trim() === t);
}
