"use client";

import { Bookmark, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { DetailHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { AddToPlanSheet } from "@/features/meal-planner/AddToPlanSheet";
import { cn } from "@/lib/cn";
import { stockOf } from "@/lib/domain/stock";
import { formatQuantity, formatWon } from "@/lib/domain/units";
import { useKitchen } from "@/lib/store/kitchen-store";
import { ingredientById, scaledRecipeNeeds } from "@/lib/store/selectors";
import { EditRecipeSheet } from "./EditRecipeSheet";
import { buildRecommendation } from "./recommend";

export function RecipeDetailScreen() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const params = useSearchParams();
  const { state, dispatch, today } = useKitchen();
  const toast = useToast();
  const initial = Math.min(3, Math.max(1, Number(params.get("servings")) || 1));
  const [servings, setServings] = useState(String(initial));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const recipe = state.recipes.find((r) => r.id === recipeId);

  if (!recipe) {
    return (
      <>
        <DetailHeader title="레시피" fallbackHref="/recipes" />
        <EmptyState title="레시피를 찾을 수 없어요" action={<Link href="/recipes" className="font-semibold text-green">추천으로 돌아가기</Link>} />
      </>
    );
  }

  const n = Number(servings);
  const rec = buildRecommendation(state, today, recipe, n);
  const needs = scaledRecipeNeeds(recipe, n);

  return (
    <div className="pb-actionbar">
      <DetailHeader
        title="레시피"
        fallbackHref="/recipes"
        right={
          <>
          {recipe.source === "user" && (
            <button
              type="button"
              aria-label="레시피 수정"
              onClick={() => setEditing(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
            >
              <Pencil size={19} strokeWidth={1.75} />
            </button>
          )}
          <button
            type="button"
            aria-label={recipe.saved ? "저장 취소" : "레시피 저장"}
            aria-pressed={recipe.saved}
            onClick={() => {
              dispatch({ type: "toggleSaveRecipe", recipeId: recipe.id });
              toast(recipe.saved ? "저장을 취소했어요" : "레시피를 저장했어요");
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
          >
            <Bookmark size={21} strokeWidth={1.75} className={recipe.saved ? "fill-green text-green" : undefined} />
          </button>
          </>
        }
      />

      <div className="px-5 pt-1">
        <p className="text-[13px] text-sub">
          {[recipe.source === "ai" ? "AI 추천 예시" : "내 레시피", recipe.cookMinutes > 0 && `${recipe.cookMinutes}분`, ...recipe.tags].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-1 text-[24px] leading-snug font-bold tracking-[-0.02em]">{recipe.title}</h1>
        {recipe.description && <p className="mt-1.5 text-[14.5px] leading-relaxed text-sub">{recipe.description}</p>}

        <SegmentedControl
          className="mt-5"
          label="인분"
          options={["1", "2", "3"].map((s) => ({ value: s, label: `${s}인분` }))}
          value={servings}
          onChange={setServings}
        />

        <div className="mt-3 grid grid-cols-3 rounded-[14px] bg-subtle px-4 py-3.5">
          <div>
            <span className="block text-[12px] text-sub">예상 원가</span>
            <b className="text-[17px] font-semibold">{formatWon(rec.cost.total)}</b>
          </div>
          <div>
            <span className="block text-[12px] text-sub">열량 (1인분)</span>
            <b className="text-[17px] font-semibold">{Math.round(rec.nutrition.kcal)}kcal</b>
          </div>
          <div>
            <span className="block text-[12px] text-sub">단백질 (1인분)</span>
            <b className="text-[17px] font-semibold">{Math.round(rec.nutrition.protein)}g</b>
          </div>
        </div>
        {(rec.cost.estimated || rec.cost.unknownCount > 0 || rec.nutrition.missing > 0) && (
          <p className="mt-2 text-[12px] leading-relaxed text-mute">
            {rec.cost.estimated && "재고 부족분은 최근 구매가로 추정했어요. "}
            {rec.cost.unknownCount > 0 && `가격 모르는 재료 ${rec.cost.unknownCount}개는 원가에서 빠졌어요. `}
            {rec.nutrition.missing > 0 && `영양 정보 없는 재료 ${rec.nutrition.missing}개는 합계에서 제외했어요.`}
          </p>
        )}

        <h2 className="mt-7 mb-1 text-[17px] font-semibold">재료</h2>
        <ul className="divide-y divide-line">
          {needs.map((need) => {
            const ing = ingredientById(state, need.ingredientId);
            const have = ing ? stockOf(state.lots, ing.id) : null;
            const enough = have == null || need.quantity == null ? null : have >= need.quantity - 1e-6;
            const label = ing && need.quantity != null && n !== recipe.servings ? `${ing.name} ${formatQuantity(need.quantity, ing)}` : need.displayText;
            return (
              <li key={need.name} className="flex items-center justify-between gap-3 py-3">
                <span className={cn("text-[15px]", need.optional && "text-sub")}>
                  {label}
                  {need.optional && <span className="ml-1 text-[12.5px] text-mute">(선택)</span>}
                </span>
                {ing && have != null ? (
                  <Link href={`/fridge/${ing.id}`} className={cn("shrink-0 text-[13px]", enough === false ? "font-semibold text-danger" : "text-sub")}>
                    {have > 0 ? `보유 ${formatQuantity(have, ing)}` : "없음"}
                  </Link>
                ) : (
                  <span className="shrink-0 text-[13px] text-mute">기본 양념</span>
                )}
              </li>
            );
          })}
        </ul>

        <h2 className="mt-7 mb-2 text-[17px] font-semibold">조리 순서</h2>
        {recipe.steps.length === 0 && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-[14px] bg-subtle px-4 py-4 text-left text-[14px] text-sub active:opacity-80"
          >
            조리 순서를 아직 적지 않았어요 — <b className="font-semibold text-green">지금 적기</b>
          </button>
        )}
        <ol className="space-y-3.5">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-soft text-[12.5px] font-bold text-green">
                {i + 1}
              </span>
              <p className="pt-0.5 text-[15px] leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-bg px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="primary" size="lg" block onClick={() => setAdding(true)}>
          식단에 추가 · {formatWon(rec.cost.total)}
        </Button>
      </div>

      <EditRecipeSheet recipe={recipe} open={editing} onClose={() => setEditing(false)} />
      <AddToPlanSheet recipe={recipe} open={adding} onClose={() => setAdding(false)} initialServings={n} />
    </div>
  );
}
