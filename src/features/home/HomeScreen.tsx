"use client";

import { Check, ChevronRight, Plus, ScanLine, Settings } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ExpiryBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, Stat } from "@/components/ui/misc";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { CompleteMealSheet } from "@/features/meal-planner/CompleteMealSheet";
import { useShortages } from "@/features/meal-planner/useShortages";
import { cn } from "@/lib/cn";
import { formatLongDate, monthOf } from "@/lib/date";
import { isUrgent } from "@/lib/domain/expiry";
import { summarizeStock } from "@/lib/domain/stock";
import { formatQuantity, formatWon, STORAGE_LABEL } from "@/lib/domain/units";
import type { MealPlan } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { HomeMemo } from "./HomeMemo";
import { MEAL_LABEL, MEAL_TYPES, mealCost, mealsOn, monthlySpend } from "@/lib/store/selectors";

export function HomeScreen() {
  const { state, today } = useKitchen();
  const shortages = useShortages();
  const [completing, setCompleting] = useState<MealPlan | null>(null);
  const soonDays = state.settings.soonDays;

  const urgent = useMemo(
    () =>
      summarizeStock(state.ingredients, state.lots, today, soonDays)
        .filter((s) => isUrgent(s.expiry, soonDays))
        .sort((a, b) => a.expiry.sortKey - b.expiry.sortKey),
    [state.ingredients, state.lots, today, soonDays],
  );
  const spend = monthlySpend(state, today);
  const todayMeals = mealsOn(state, today);
  const nextPlanned = todayMeals.find((m) => m.status === "planned");

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title="오늘"
        right={
          <Link
            href="/settings"
            aria-label="설정"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
          >
            <Settings size={22} strokeWidth={1.6} />
          </Link>
        }
      />

      <div className="space-y-7 px-5">
        <Link href="/scan" className="flex items-center gap-3 rounded-[14px] bg-green-soft py-3.5 pr-3.5 pl-4 active:opacity-80">
          <ScanLine size={22} className="shrink-0 text-green" strokeWidth={1.75} />
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold text-green-ink">장 보고 오셨나요?</b>
            <span className="text-[13px] text-[#56715d]">영수증을 찍으면 재고에 바로 등록돼요</span>
          </span>
          <ChevronRight size={18} className="text-[#56715d]" />
        </Link>

        <section>
          <SectionHeader
            title="오늘의 식사"
            right={
              <Link href={`/planner?date=${today}`} className="text-[14px] text-sub">
                식단표
              </Link>
            }
          />
          <Card className="divide-y divide-line">
            {MEAL_TYPES.map((type) => {
              const meals = todayMeals.filter((m) => m.mealType === type);
              if (meals.length === 0) {
                return (
                  <div key={type} className="flex items-center gap-3 py-3.5 pr-3.5 pl-4">
                    <span className="w-9 shrink-0 text-[13px] font-medium text-sub">{MEAL_LABEL[type]}</span>
                    <span className="flex-1 text-[15px] text-mute">계획 없음</span>
                    <Link
                      href={`/planner?date=${today}&add=${type}`}
                      className="inline-flex h-9 items-center gap-1 rounded-[10px] px-2.5 text-[14px] font-semibold text-green active:bg-subtle"
                    >
                      <Plus size={16} /> 추가
                    </Link>
                  </div>
                );
              }
              return meals.map((meal, idx) => {
                const cost = mealCost(state, meal);
                const lack = shortages.get(meal.id)?.size ?? 0;
                return (
                  <div key={meal.id} className="flex items-center gap-3 py-3.5 pr-3.5 pl-4">
                    <span className="w-9 shrink-0 text-[13px] font-medium text-sub">{idx === 0 ? MEAL_LABEL[type] : ""}</span>
                    <Link href={`/planner/${meal.id}`} className="min-w-0 flex-1">
                      <b
                        className={cn(
                          "block truncate text-[16px] font-semibold",
                          meal.status !== "planned" && "text-sub",
                          meal.status === "skipped" && "line-through",
                        )}
                      >
                        {meal.title}
                      </b>
                      <span className={cn("text-[13px]", lack > 0 && meal.status === "planned" ? "text-danger" : "text-sub")}>
                        {meal.status === "done"
                          ? `원가 ${formatWon(cost.total)}`
                          : meal.status === "skipped"
                            ? "건너뜀"
                            : lack > 0
                              ? `재료 ${lack}개 부족`
                              : `예상 ${formatWon(cost.total)}${meal.items.length ? ` · 재료 ${meal.items.length}개` : ""}`}
                      </span>
                    </Link>
                    {meal.status === "done" ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-soft text-green" aria-label="완료됨">
                        <Check size={16} strokeWidth={2.4} />
                      </span>
                    ) : meal.status === "planned" ? (
                      <Button
                        size="sm"
                        variant={meal.id === nextPlanned?.id ? "primary" : "secondary"}
                        onClick={() => setCompleting(meal)}
                      >
                        완료
                      </Button>
                    ) : null}
                  </div>
                );
              });
            })}
          </Card>
        </section>

        <HomeMemo />

        <section>
          <SectionHeader
            title="곧 소비기한"
            right={
              <Link href="/fridge?location=all" className="text-[14px] text-sub">
                {urgent.length > 0 ? `전체 ${urgent.length}` : "냉장고"}
              </Link>
            }
          />
          {urgent.length === 0 ? (
            <p className="rounded-[14px] bg-subtle px-4 py-4 text-[14px] text-sub">
              {soonDays}일 안에 소비기한이 다가오는 재료가 없어요.
            </p>
          ) : (
            <ul>
              {urgent.slice(0, 3).map((s, i, arr) => (
                <li key={s.ingredient.id}>
                  <Link
                    href={`/fridge/${s.ingredient.id}`}
                    className={cn("flex items-center gap-3 py-3", i < arr.length - 1 && "border-b border-line")}
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block text-[16px] font-semibold">{s.ingredient.name}</b>
                      <span className="text-[13px] text-sub">
                        {STORAGE_LABEL[s.lots[0].storage]} · {formatQuantity(s.total, s.ingredient)}
                        {s.expiry.kind === "recommended" && " · 기한 정보 없음"}
                      </span>
                    </span>
                    <ExpiryBadge info={s.expiry} withPrefix />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid grid-cols-2 rounded-[14px] bg-subtle px-4 py-3.5">
          <Stat label={`${monthOf(today)}월 식비 (사용 재료 기준)`} value={formatWon(spend.food)} />
          <div className="text-right">
            <Stat label={`${monthOf(today)}월 폐기`} value={formatWon(spend.waste)} tone={spend.waste > 0 ? "danger" : undefined} />
          </div>
        </section>
      </div>

      {completing && (
        <CompleteMealSheet meal={completing} open={!!completing} onClose={() => setCompleting(null)} />
      )}
    </>
  );
}
