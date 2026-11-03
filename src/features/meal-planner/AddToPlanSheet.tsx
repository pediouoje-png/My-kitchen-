"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { addDays, dayOfMonth, formatShortDate, weekdayLabel } from "@/lib/date";
import { formatWon } from "@/lib/domain/units";
import type { ISODate, MealType, Recipe } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { MEAL_LABEL, MEAL_TYPES, mealsOn, recipeCost } from "@/lib/store/selectors";
import { mealFromRecipe } from "./build";

/** 레시피 → 식단 추가 (날짜 · 끼니 · 인분 선택) */
export function AddToPlanSheet({
  recipe,
  open,
  onClose,
  initialDate,
  initialMeal,
  initialServings = 1,
  onAdded,
}: {
  recipe: Recipe;
  open: boolean;
  onClose: () => void;
  initialDate?: ISODate;
  initialMeal?: MealType;
  initialServings?: number;
  onAdded?: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="식단에 추가" description={recipe.title}>
      {open && (
        <AddToPlanBody
          recipe={recipe}
          initialDate={initialDate}
          initialMeal={initialMeal}
          initialServings={initialServings}
          onDone={() => {
            onClose();
            onAdded?.();
          }}
        />
      )}
    </Sheet>
  );
}

function AddToPlanBody({
  recipe,
  initialDate,
  initialMeal,
  initialServings,
  onDone,
}: {
  recipe: Recipe;
  initialDate?: ISODate;
  initialMeal?: MealType;
  initialServings: number;
  onDone: () => void;
}) {
  const { state, dispatch, today } = useKitchen();
  const toast = useToast();
  const [date, setDate] = useState<ISODate>(initialDate ?? today);
  const [mealType, setMealType] = useState<MealType>(initialMeal ?? "dinner");
  const [servings, setServings] = useState(String(initialServings));
  const days = Array.from({ length: 7 }, (_, i) => addDays(initialDate && initialDate < today ? initialDate : today, i));
  const cost = recipeCost(state, recipe, Number(servings));
  const existing = mealsOn(state, date, mealType);

  const add = () => {
    dispatch({ type: "addMeal", meal: mealFromRecipe(recipe, date, mealType, Number(servings)) });
    toast(`${formatShortDate(date)} ${MEAL_LABEL[mealType]}에 추가했어요`, {
      label: "식단 보기",
      href: `/planner?date=${date}`,
    });
    onDone();
  };

  return (
    <div>
      <p className="text-[13px] text-sub">날짜</p>
      <div className="no-scrollbar -mx-5 mt-1.5 flex gap-1.5 overflow-x-auto px-5">
        {days.map((d) => {
          const on = d === date;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              aria-pressed={on}
              className={cn(
                "flex h-16 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-[12px]",
                on ? "border-ink bg-ink text-[#c9cec9]" : "border-line text-sub",
              )}
            >
              {d === today ? "오늘" : weekdayLabel(d)}
              <b className={cn("text-[17px] font-semibold", on ? "text-white" : "text-ink")}>{dayOfMonth(d)}</b>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-[13px] text-sub">끼니</p>
      <SegmentedControl
        className="mt-1.5"
        label="끼니"
        options={MEAL_TYPES.map((t) => ({ value: t, label: MEAL_LABEL[t] }))}
        value={mealType}
        onChange={setMealType}
      />
      {existing.length > 0 && (
        <p className="mt-2 text-[12.5px] text-sub">이미 등록됨: {existing.map((m) => m.title).join(", ")} — 함께 추가돼요</p>
      )}

      <p className="mt-5 text-[13px] text-sub">인분</p>
      <SegmentedControl
        className="mt-1.5"
        label="인분"
        options={["1", "2", "3"].map((s) => ({ value: s, label: `${s}인분` }))}
        value={servings}
        onChange={setServings}
      />

      <div className="mt-5 flex items-baseline justify-between rounded-xl bg-subtle px-4 py-3">
        <span className="text-[14px] text-sub">예상 원가</span>
        <span className="text-right">
          <b className="text-[18px] font-bold">{formatWon(cost.total)}</b>
          {(cost.estimated || cost.unknownCount > 0) && (
            <span className="block text-[12px] text-warn">
              {cost.unknownCount > 0 ? `가격 모르는 재료 ${cost.unknownCount}개 제외` : "부족분은 최근 구매가로 추정"}
            </span>
          )}
        </span>
      </div>

      <Button variant="primary" size="lg" block className="mt-4" onClick={add}>
        {formatShortDate(date)} {MEAL_LABEL[mealType]}에 추가
      </Button>
    </div>
  );
}
