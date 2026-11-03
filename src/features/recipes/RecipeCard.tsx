"use client";

import { Bookmark, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/misc";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useKitchen } from "@/lib/store/kitchen-store";
import { reasonLine, type Recommendation } from "./recommend";

export function RecipeCard({ rec, servings, onAdd }: { rec: Recommendation; servings: number; onAdd: () => void }) {
  const { dispatch } = useKitchen();
  const toast = useToast();
  const { recipe, cost, nutrition } = rec;
  const total = rec.owned.length + rec.missing.length;

  return (
    <article className="rounded-[14px] border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <p className={cn("flex items-center gap-1 text-[12.5px] font-semibold", rec.expiringUsed.length > 0 ? "text-green" : "text-sub")}>
          <Clock size={14} strokeWidth={2} />
          {reasonLine(rec)}
        </p>
        <button
          type="button"
          aria-label={recipe.saved ? "저장 취소" : "레시피 저장"}
          aria-pressed={recipe.saved}
          onClick={() => {
            dispatch({ type: "toggleSaveRecipe", recipeId: recipe.id });
            toast(recipe.saved ? "저장을 취소했어요" : "레시피를 저장했어요");
          }}
          className="-mt-2 -mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-subtle"
        >
          <Bookmark size={20} strokeWidth={1.75} className={recipe.saved ? "fill-green text-green" : "text-mute"} />
        </button>
      </div>
      <Link href={`/recipes/${recipe.id}?servings=${servings}`} className="block">
        <h3 className="-mt-1 text-[18px] font-semibold tracking-[-0.01em]">{recipe.title}</h3>
        <p className="mt-0.5 text-[13px] text-sub">
          {recipe.cookMinutes}분 · {rec.missing.length === 0 ? `재료 ${total}개 모두 보유` : `재료 ${total}개 중 ${rec.owned.length}개 보유`}
        </p>
      </Link>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {recipe.ingredients
          .filter((i) => !i.optional && i.ingredientId)
          .map((i) =>
            rec.missing.includes(i.name) ? (
              <Chip key={i.name} tone="missing">
                {i.name} 없음
              </Chip>
            ) : (
              <Chip key={i.name}>{i.name}</Chip>
            ),
          )}
      </div>
      <div className="mt-3.5 grid grid-cols-3 border-t border-line pt-3">
        <div>
          <span className="block text-[12px] text-sub">예상 원가</span>
          <b className="text-[16px] font-semibold">
            {cost.total.toLocaleString("ko-KR")}
            <small className="ml-0.5 text-[12px] font-medium text-sub">원</small>
          </b>
          {(cost.estimated || cost.unknownCount > 0) && (
            <span className="block text-[11.5px] font-medium text-warn">{cost.unknownCount > 0 ? "일부 가격 없음" : "일부 최근가 기준"}</span>
          )}
        </div>
        <div>
          <span className="block text-[12px] text-sub">열량</span>
          <b className="text-[16px] font-semibold">
            {Math.round(nutrition.kcal)}
            <small className="ml-0.5 text-[12px] font-medium text-sub">kcal</small>
          </b>
        </div>
        <div>
          <span className="block text-[12px] text-sub">단백질</span>
          <b className="text-[16px] font-semibold">
            {Math.round(nutrition.protein)}
            <small className="ml-0.5 text-[12px] font-medium text-sub">g</small>
          </b>
        </div>
      </div>
      {nutrition.missing > 0 && <p className="mt-1.5 text-[11.5px] text-mute">영양 정보 없는 재료 {nutrition.missing}개 제외 · 1인분 기준</p>}
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <Link
          href={`/recipes/${recipe.id}?servings=${servings}`}
          className="inline-flex h-[42px] items-center justify-center rounded-xl border border-line text-[15px] font-semibold active:bg-subtle"
        >
          레시피 보기
        </Link>
        <Button variant="primary" className="h-[42px]" onClick={onAdd}>
          식단에 추가
        </Button>
      </div>
    </article>
  );
}
