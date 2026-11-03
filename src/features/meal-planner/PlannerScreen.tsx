"use client";

import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Chip } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { addDays, dayOfMonth, isISODate, monthOf, weekDates, weekdayLabel } from "@/lib/date";
import { formatQuantity, formatWon } from "@/lib/domain/units";
import type { ISODate, MealPlan, MealType } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { ingredientById, MEAL_LABEL, MEAL_TYPES, mealCost, mealsOn } from "@/lib/store/selectors";
import { AddMealSheet } from "./AddMealSheet";
import { SOURCE_LABEL } from "./build";
import { useShortages } from "./useShortages";

function isMealType(v: string | null): v is MealType {
  return v === "breakfast" || v === "lunch" || v === "dinner";
}

export function PlannerScreen() {
  const { state, today } = useKitchen();
  const router = useRouter();
  const params = useSearchParams();
  const paramDate = params.get("date");
  const selected: ISODate = isISODate(paramDate) ? paramDate : today;
  const addParam = params.get("add");
  const [adding, setAdding] = useState<MealType | null>(isMealType(addParam) ? addParam : null);
  const shortages = useShortages();

  const week = weekDates(selected);
  const select = (d: ISODate) => router.replace(`/planner?date=${d}`, { scroll: false });

  const summary = useMemo(() => {
    let planned = 0;
    let spent = 0;
    const lacking = new Set<string>();
    for (const m of state.meals) {
      if (m.date < week[0] || m.date > week[6]) continue;
      if (m.status === "done") spent += m.actualCost ?? 0;
      if (m.status === "planned") {
        planned += mealCost(state, m).total;
        shortages.get(m.id)?.forEach((_, id) => lacking.add(id));
      }
    }
    return { planned, spent, lacking: lacking.size };
  }, [state, week, shortages]);

  const closeAdd = () => {
    setAdding(null);
    if (addParam) router.replace(`/planner?date=${selected}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="식단"
        right={
          <>
            {!week.includes(today) && (
              <button
                type="button"
                onClick={() => select(today)}
                className="h-9 rounded-full border border-line px-3.5 text-[14px] font-semibold active:bg-subtle"
              >
                오늘
              </button>
            )}
            <button
              type="button"
              aria-label="메뉴 추가"
              onClick={() => setAdding(firstEmptySlot(state.meals, selected))}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
            >
              <Plus size={24} strokeWidth={1.75} />
            </button>
          </>
        }
      />

      <div className="px-5">
        <div className="-mx-2 mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="이전 주"
            onClick={() => select(addDays(selected, -7))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
          >
            <ChevronLeft size={22} strokeWidth={1.75} />
          </button>
          <b className="text-[15px] font-semibold">
            {monthOf(week[0])}월 {dayOfMonth(week[0])}일 – {monthOf(week[6]) !== monthOf(week[0]) && `${monthOf(week[6])}월 `}
            {dayOfMonth(week[6])}일
          </b>
          <button
            type="button"
            aria-label="다음 주"
            onClick={() => select(addDays(selected, 7))}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
          >
            <ChevronRight size={22} strokeWidth={1.75} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1" role="tablist" aria-label="요일 선택">
          {week.map((d) => {
            const on = d === selected;
            const meals = mealsOn(state, d);
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => select(d)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl pt-2 pb-2.5 text-[12px] transition-colors",
                  on ? "bg-ink text-[#c9cec9]" : "text-sub active:bg-subtle",
                )}
              >
                {weekdayLabel(d)}
                <b className={cn("text-[17px] font-semibold", on ? "text-white" : d === today ? "text-green" : "text-ink")}>
                  {dayOfMonth(d)}
                </b>
                <span className="flex h-[5px] gap-[3px]">
                  {meals.slice(0, 3).map((m) => (
                    <i
                      key={m.id}
                      className={cn(
                        "h-[5px] w-[5px] rounded-full",
                        m.status === "done" ? (on ? "bg-[#8fc09c]" : "bg-green") : on ? "bg-[#59605b]" : "bg-[#cfd5d0]",
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {MEAL_TYPES.map((type) => (
          <MealSlot
            key={type}
            type={type}
            meals={mealsOn(state, selected, type)}
            shortages={shortages}
            onAdd={() => setAdding(type)}
          />
        ))}
      </div>

      <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] mt-6 border-t border-line bg-bg/95 px-5 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-sub">
            이번 주 예상 <b className="font-semibold text-ink">{formatWon(summary.planned)}</b>
            {summary.spent > 0 && <span className="text-mute"> · 사용 {formatWon(summary.spent)}</span>}
          </span>
          {summary.lacking > 0 ? (
            <span className="font-semibold text-danger">부족 재료 {summary.lacking}개</span>
          ) : (
            <span className="font-medium text-green">재료 충분</span>
          )}
        </div>
      </div>

      {adding && <AddMealSheet open date={selected} mealType={adding} onClose={closeAdd} />}
    </>
  );
}

function firstEmptySlot(meals: MealPlan[], date: ISODate): MealType {
  return MEAL_TYPES.find((t) => !meals.some((m) => m.date === date && m.mealType === t)) ?? "dinner";
}

function MealSlot({
  type,
  meals,
  shortages,
  onAdd,
}: {
  type: MealType;
  meals: MealPlan[];
  shortages: Map<string, Map<string, number>>;
  onAdd: () => void;
}) {
  const { state } = useKitchen();
  const active = meals.filter((m) => m.status !== "skipped");
  const allDone = active.length > 0 && active.every((m) => m.status === "done");
  const total = active.reduce((s, m) => s + mealCost(state, m).total, 0);

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">{MEAL_LABEL[type]}</h3>
        <div className="flex items-center gap-1">
          {active.length > 0 && (
            <span className="text-[13px] text-sub">
              {allDone ? "완료 · " : "예상 "}
              {formatWon(total)}
            </span>
          )}
          {meals.length > 0 && (
            <button
              type="button"
              aria-label={`${MEAL_LABEL[type]} 메뉴 추가`}
              onClick={onAdd}
              className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-subtle"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>
      {meals.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-line-strong text-[14px] font-medium text-sub active:bg-subtle"
        >
          <Plus size={17} /> {MEAL_LABEL[type]} 메뉴 추가
        </button>
      ) : (
        <div className="space-y-2">
          {meals.map((m) => (
            <MealCard key={m.id} meal={m} shortage={shortages.get(m.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function MealCard({ meal, shortage }: { meal: MealPlan; shortage?: Map<string, number> }) {
  const { state } = useKitchen();
  const recipe = meal.recipeId ? state.recipes.find((r) => r.id === meal.recipeId) : undefined;
  const lack = meal.status === "planned" ? (shortage?.size ?? 0) : 0;
  const meta = [SOURCE_LABEL[meal.source], `${meal.servings}인분`, recipe && `${recipe.cookMinutes}분`].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/planner/${meal.id}`}
      className={cn(
        "block rounded-[14px] border border-line px-4 py-3.5 active:bg-subtle",
        meal.status === "skipped" && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b
            className={cn(
              "block text-[16px] font-semibold",
              meal.status === "done" && "text-sub",
              meal.status === "skipped" && "line-through",
            )}
          >
            {meal.title}
          </b>
          {meal.status !== "done" && <p className="mt-0.5 text-[13px] text-sub">{meta}</p>}
        </div>
        {meal.status === "done" ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-soft text-green" aria-label="완료됨">
            <Check size={15} strokeWidth={2.4} />
          </span>
        ) : meal.status === "skipped" ? (
          <Badge>건너뜀</Badge>
        ) : lack > 0 ? (
          <Badge tone="danger">{lack}개 부족</Badge>
        ) : meal.items.length > 0 ? (
          <Badge tone="green">재료 충분</Badge>
        ) : null}
      </div>
      {meal.status === "planned" && meal.items.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {meal.items.map((item) => {
            const ing = ingredientById(state, item.ingredientId);
            if (!ing) return null;
            const missing = shortage?.get(item.ingredientId);
            return missing ? (
              <Chip key={item.id} tone="missing">
                {ing.name} {formatQuantity(missing, ing)} 부족
              </Chip>
            ) : (
              <Chip key={item.id}>
                {ing.name} {formatQuantity(item.plannedQuantity, ing)}
              </Chip>
            );
          })}
        </div>
      )}
    </Link>
  );
}
