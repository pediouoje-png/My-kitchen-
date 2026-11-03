import type { CostEstimate } from "@/lib/domain/costing";
import { isUrgent } from "@/lib/domain/expiry";
import { stockOf, summarizeStock } from "@/lib/domain/stock";
import type { ISODate, KitchenState, Recipe } from "@/lib/domain/types";
import { recipeCost, recipeNutrition, scaledRecipeNeeds } from "@/lib/store/selectors";

/**
 * Phase 1 추천 엔진 (AI 미연결).
 * 저장된 예시 레시피 풀에서 "보유율 · 임박 재료 활용 · 원가 · 영양"을 코드로 점수화해 고른다.
 * Phase 5에서 후보 생성은 AI가 맡고, 아래 점수 계산·원가·영양 계산은 그대로 재사용한다.
 */

export interface RecommendOptions {
  expiring: boolean;
  budget: boolean;
  protein: boolean;
  quick: boolean;
  servings: number;
}

export interface Recommendation {
  recipe: Recipe;
  cost: CostEstimate;
  nutrition: ReturnType<typeof recipeNutrition>;
  owned: string[];
  missing: string[];
  expiringUsed: string[];
  score: number;
}

export function buildRecommendation(state: KitchenState, today: ISODate, recipe: Recipe, servings: number): Recommendation {
  const urgentIds = new Set(
    summarizeStock(state.ingredients, state.lots, today, state.settings.soonDays)
      .filter((s) => isUrgent(s.expiry, state.settings.soonDays))
      .map((s) => s.ingredient.id),
  );
  const owned: string[] = [];
  const missing: string[] = [];
  const expiringUsed: string[] = [];
  for (const need of scaledRecipeNeeds(recipe, servings)) {
    if (need.optional) continue;
    if (!need.ingredientId) {
      owned.push(need.name); // 기본 양념류는 보유로 간주
      continue;
    }
    const have = stockOf(state.lots, need.ingredientId);
    if (have > 0 && (need.quantity == null || have >= need.quantity - 1e-6)) owned.push(need.name);
    else missing.push(need.name);
    if (urgentIds.has(need.ingredientId) && have > 0) expiringUsed.push(need.name);
  }
  return {
    recipe,
    cost: recipeCost(state, recipe, servings),
    nutrition: recipeNutrition(state, recipe, servings),
    owned,
    missing,
    expiringUsed,
    score: 0,
  };
}

export function recommend(
  state: KitchenState,
  today: ISODate,
  opts: RecommendOptions,
  exclude: Set<string> = new Set(),
  count = 3,
): Recommendation[] {
  const scored = state.recipes
    .map((r) => buildRecommendation(state, today, r, opts.servings))
    .filter((r) => !opts.quick || r.recipe.cookMinutes <= 15)
    .filter((r) => !opts.protein || r.nutrition.protein >= 20)
    .map((r) => {
      const total = r.owned.length + r.missing.length || 1;
      const ownedRatio = r.owned.length / total;
      let score = ownedRatio * 40;
      if (opts.expiring) score += r.expiringUsed.length * 18;
      if (opts.budget) score += Math.max(0, 20 - (r.cost.total / opts.servings) / 250);
      if (opts.protein) score += r.nutrition.protein / 2;
      score -= r.missing.length * 6;
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);

  const fresh = scored.filter((r) => !exclude.has(r.recipe.id));
  return (fresh.length >= Math.min(count, scored.length) ? fresh : scored).slice(0, count);
}

export function reasonLine(r: Recommendation): string {
  if (r.expiringUsed.length > 0) return `임박 재료 ${r.expiringUsed.length}개 사용 · ${r.expiringUsed.join(", ")}`;
  if (r.missing.length === 0) return "지금 있는 재료로 바로 가능";
  return `재료 ${r.missing.length}개만 더 있으면 돼요`;
}
