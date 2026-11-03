"use client";

import { ArrowRightLeft, BookmarkPlus, BookOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/misc";
import { DetailHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { addDays, dayOfMonth, formatMD, formatShortDate, relativeDayLabel, weekdayLabel } from "@/lib/date";
import { allocateFIFO } from "@/lib/domain/costing";
import { stockOf } from "@/lib/domain/stock";
import { formatQuantity, formatUnitPrice, formatWon } from "@/lib/domain/units";
import type { ISODate, MealPlan, MealType } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { ingredientById, MEAL_LABEL, MEAL_TYPES, mealCost } from "@/lib/store/selectors";
import { findUserRecipe, recipeFromItems } from "@/features/recipes/fromMeal";
import { SOURCE_LABEL } from "./build";
import { CompleteMealSheet } from "./CompleteMealSheet";
import { useShortages } from "./useShortages";

export function MealDetailScreen() {
  const { mealId } = useParams<{ mealId: string }>();
  const { state, dispatch, today } = useKitchen();
  const router = useRouter();
  const toast = useToast();
  const shortages = useShortages();
  const [completing, setCompleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const meal = state.meals.find((m) => m.id === mealId);
  if (!meal) {
    return (
      <>
        <DetailHeader title="식사" fallbackHref="/planner" />
        <EmptyState
          title="식단을 찾을 수 없어요"
          description="삭제되었거나 잘못된 주소예요."
          action={
            <Link href="/planner" className="font-semibold text-green">
              식단으로 돌아가기
            </Link>
          }
        />
      </>
    );
  }

  const cost = mealCost(state, meal);
  const recipe = meal.recipeId ? state.recipes.find((r) => r.id === meal.recipeId) : undefined;
  const lack = shortages.get(meal.id);
  const logs = state.logs.filter((l) => l.mealPlanId === meal.id && l.reason === "meal");

  const remove = () => {
    dispatch({ type: "deleteMeal", mealId: meal.id });
    toast("식단에서 삭제했어요");
    router.replace(`/planner?date=${meal.date}`);
  };

  return (
    <div className="pb-actionbar">
      <DetailHeader title={`${relativeDayLabel(meal.date, today)} ${MEAL_LABEL[meal.mealType]}`} fallbackHref={`/planner?date=${meal.date}`} />

      <div className="px-5 pt-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className={cn("text-[24px] leading-snug font-bold tracking-[-0.02em]", meal.status === "skipped" && "text-sub line-through")}>
            {meal.title}
          </h1>
          {meal.status === "done" && <Badge tone="green" className="mt-1.5">완료</Badge>}
          {meal.status === "skipped" && <Badge className="mt-1.5">건너뜀</Badge>}
        </div>
        <p className="mt-1 text-[14px] text-sub">
          {formatShortDate(meal.date)} · {SOURCE_LABEL[meal.source]} · {meal.servings}인분
        </p>
        {!recipe && (
          <button
            type="button"
            onClick={() => {
              const same = findUserRecipe(state.recipes, meal.title);
              const target = same ?? recipeFromItems(meal.title, meal.items, meal.servings, state.ingredients);
              if (!same) dispatch({ type: "addRecipe", recipe: target });
              else if (!same.saved) dispatch({ type: "updateRecipe", id: same.id, patch: { saved: true } });
              dispatch({ type: "linkMealRecipe", mealId: meal.id, recipeId: target.id });
              toast("내 레시피에 저장했어요", { label: "보기", href: `/recipes/${target.id}` });
            }}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[14px] font-medium active:bg-subtle"
          >
            <BookmarkPlus size={16} strokeWidth={1.75} /> 내 레시피로 저장
          </button>
        )}
        {recipe && (
          <Link
            href={`/recipes/${recipe.id}`}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[14px] font-medium active:bg-subtle"
          >
            <BookOpen size={16} strokeWidth={1.75} /> 레시피 보기{recipe.cookMinutes > 0 && ` · ${recipe.cookMinutes}분`}
          </Link>
        )}

        <div className="mt-5 flex items-baseline justify-between rounded-[14px] bg-subtle px-4 py-3.5">
          <span className="text-[14px] text-sub">{meal.status === "done" ? "실제 원가" : "예상 원가"}</span>
          <span className="text-right">
            <b className="text-[20px] font-bold">{formatWon(cost.total)}</b>
            {meal.status === "planned" && (cost.estimated || cost.unknownCount > 0) && (
              <span className="block text-[12px] text-warn">
                {cost.unknownCount > 0 ? `가격 모르는 재료 ${cost.unknownCount}개 제외` : "부족분은 최근 구매가로 추정"}
              </span>
            )}
          </span>
        </div>

        <h2 className="mt-7 mb-1 text-[17px] font-semibold">재료</h2>
        {meal.items.length === 0 ? (
          <p className="py-3 text-[14px] text-sub">연결된 식재료가 없어요. 완료해도 재고는 변하지 않아요.</p>
        ) : meal.status === "done" ? (
          <ul className="divide-y divide-line">
            {meal.items.map((item) => {
              const ing = ingredientById(state, item.ingredientId);
              if (!ing) return null;
              const mine = logs.filter((l) => l.ingredientId === item.ingredientId);
              return (
                <li key={item.id} className="py-3">
                  <div className="flex items-baseline justify-between">
                    <Link href={`/fridge/${ing.id}`} className="text-[15.5px] font-semibold">
                      {ing.name}
                    </Link>
                    <span className="text-[15px]">{formatQuantity(item.plannedQuantity, ing)}</span>
                  </div>
                  {mine.map((l) => {
                    const lot = state.lots.find((x) => x.id === l.lotId);
                    return (
                      <p key={l.id} className="mt-0.5 text-[13px] text-sub">
                        {lot ? `${formatMD(lot.acquiredOn)} ${lot.sourceLabel ?? "직접 등록"}` : "재고"}에서 {formatQuantity(l.quantity, ing)} ·{" "}
                        {l.unitCost == null ? "가격 정보 없음" : formatWon(l.cost)}
                      </p>
                    );
                  })}
                  {item.shortageQuantity > 0 && (
                    <p className="mt-0.5 text-[13px] text-danger">재고 없이 사용 {formatQuantity(item.shortageQuantity, ing)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="divide-y divide-line">
            {meal.items.map((item) => {
              const ing = ingredientById(state, item.ingredientId);
              if (!ing) return null;
              const stock = stockOf(state.lots, item.ingredientId);
              const first = allocateFIFO(state.lots, item.ingredientId, item.plannedQuantity).allocations[0];
              const lot = first && state.lots.find((l) => l.id === first.lotId);
              const missing = meal.status === "planned" ? lack?.get(item.ingredientId) : undefined;
              return (
                <li key={item.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/fridge/${ing.id}`} className="text-[15.5px] font-semibold">
                      {ing.name}
                    </Link>
                    <span className="text-[15px]">{formatQuantity(item.plannedQuantity, ing)}</span>
                  </div>
                  <div className="mt-0.5 flex justify-between gap-3 text-[13px]">
                    <span className="truncate text-sub">
                      {lot ? `${formatMD(lot.acquiredOn)} ${lot.sourceLabel ?? "직접 등록"} · ${formatUnitPrice(lot.unitCost, ing)}` : "보유 재고 없음"}
                    </span>
                    <span className={cn("shrink-0", missing ? "font-semibold text-danger" : "text-sub")}>
                      {missing ? `${formatQuantity(missing, ing)} 부족` : `보유 ${formatQuantity(stock, ing)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {meal.status !== "done" && (
          <Card className="mt-7 divide-y divide-line">
            {meal.status === "planned" && (
              <button type="button" onClick={() => setMoving(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] active:bg-subtle">
                <ArrowRightLeft size={18} className="text-sub" strokeWidth={1.75} /> 다른 날로 옮기기
              </button>
            )}
            <button type="button" onClick={() => setConfirmDelete(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] text-danger active:bg-danger-soft">
              <Trash2 size={18} strokeWidth={1.75} /> 식단에서 삭제
            </button>
          </Card>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-bg px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {meal.status === "planned" && (
          <div className="grid grid-cols-[108px_1fr] gap-2">
            <Button size="lg" onClick={() => { dispatch({ type: "skipMeal", mealId: meal.id }); toast("이번 식사는 건너뛰었어요"); }}>
              건너뛰기
            </Button>
            <Button variant="primary" size="lg" onClick={() => setCompleting(true)}>
              식사 완료
            </Button>
          </div>
        )}
        {meal.status === "done" && (
          <Button
            size="lg"
            block
            onClick={() => {
              dispatch({ type: "undoMeal", mealId: meal.id, on: today });
              toast("완료를 취소하고 재고를 되돌렸어요");
            }}
          >
            완료 취소 (재고 되돌리기)
          </Button>
        )}
        {meal.status === "skipped" && (
          <Button variant="primary" size="lg" block onClick={() => dispatch({ type: "restoreMeal", mealId: meal.id })}>
            다시 계획하기
          </Button>
        )}
      </div>

      <CompleteMealSheet meal={meal} open={completing} onClose={() => setCompleting(false)} />
      <MoveMealSheet meal={meal} open={moving} onClose={() => setMoving(false)} />
      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="식단에서 삭제할까요?"
        description={`${formatShortDate(meal.date)} ${MEAL_LABEL[meal.mealType]} · ${meal.title}`}
      >
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button size="lg" onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
          <Button variant="danger" size="lg" onClick={remove}>
            삭제
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function MoveMealSheet({ meal, open, onClose }: { meal: MealPlan; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="다른 날로 옮기기" description={meal.title}>
      {open && <MoveMealBody meal={meal} onDone={onClose} />}
    </Sheet>
  );
}

function MoveMealBody({ meal, onDone }: { meal: MealPlan; onDone: () => void }) {
  const { dispatch, today } = useKitchen();
  const toast = useToast();
  const router = useRouter();
  const [date, setDate] = useState<ISODate>(meal.date);
  const [type, setType] = useState<MealType>(meal.mealType);
  const start = meal.date < today ? meal.date : today;
  const days = Array.from({ length: 10 }, (_, i) => addDays(start, i));

  return (
    <div>
      <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === date}
            onClick={() => setDate(d)}
            className={cn(
              "flex h-16 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-[12px]",
              d === date ? "border-ink bg-ink text-[#c9cec9]" : "border-line text-sub",
            )}
          >
            {d === today ? "오늘" : weekdayLabel(d)}
            <b className={cn("text-[17px] font-semibold", d === date ? "text-white" : "text-ink")}>{dayOfMonth(d)}</b>
          </button>
        ))}
      </div>
      <SegmentedControl
        className="mt-4"
        label="끼니"
        options={MEAL_TYPES.map((t) => ({ value: t, label: MEAL_LABEL[t] }))}
        value={type}
        onChange={setType}
      />
      <Button
        variant="primary"
        size="lg"
        block
        className="mt-5"
        onClick={() => {
          dispatch({ type: "moveMeal", mealId: meal.id, date, mealType: type });
          toast(`${formatShortDate(date)} ${MEAL_LABEL[type]}로 옮겼어요`);
          onDone();
          router.replace(`/planner/${meal.id}`);
        }}
      >
        옮기기
      </Button>
    </div>
  );
}
