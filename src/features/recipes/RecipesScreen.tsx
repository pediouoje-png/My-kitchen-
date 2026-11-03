"use client";

import { Check, ChevronDown, RefreshCw, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AddToPlanSheet } from "@/features/meal-planner/AddToPlanSheet";
import { cn } from "@/lib/cn";
import { formatShortDate, isISODate } from "@/lib/date";
import { isUrgent } from "@/lib/domain/expiry";
import { summarizeStock } from "@/lib/domain/stock";
import type { Recipe } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { isMealType, MEAL_LABEL } from "@/lib/store/selectors";
import { RecipeCard } from "./RecipeCard";
import { buildRecommendation, recommend, type RecommendOptions, type Recommendation } from "./recommend";

type Tab = "recommend" | "saved";
type FilterKey = "expiring" | "budget" | "protein" | "quick";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "expiring", label: "임박 재료 우선" },
  { key: "budget", label: "가성비" },
  { key: "protein", label: "고단백" },
  { key: "quick", label: "15분 이내" },
];

export function RecipesScreen() {
  const { state, today } = useKitchen();
  const router = useRouter();
  const params = useSearchParams();
  const targetDate = isISODate(params.get("date")) ? params.get("date")! : undefined;
  const targetMealParam = params.get("meal");
  const targetMeal = isMealType(targetMealParam) ? targetMealParam : undefined;
  const hasTarget = !!targetDate && !!targetMeal;

  const [tab, setTab] = useState<Tab>("recommend");
  const [opts, setOpts] = useState<RecommendOptions>({ expiring: true, budget: true, protein: false, quick: false, servings: 1 });
  const [resultIds, setResultIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<Recipe | null>(null);
  const shown = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const context = useMemo(() => {
    const stock = summarizeStock(state.ingredients, state.lots, today, state.settings.soonDays);
    return { owned: stock.length, urgent: stock.filter((s) => isUrgent(s.expiry, state.settings.soonDays)) };
  }, [state.ingredients, state.lots, today, state.settings.soonDays]);

  // 실제 AI 호출을 대신하는 짧은 대기 (Phase 5에서 /api/recipes/recommend 로 교체)
  const run = (nextOpts: RecommendOptions, more = false) => {
    if (!more) shown.current = new Set();
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const list = recommend(state, today, nextOpts, shown.current);
      list.forEach((r) => shown.current.add(r.recipe.id));
      setResultIds(list.map((r) => r.recipe.id));
      setLoading(false);
    }, 700);
  };

  // 결과는 id만 보관하고 현재 재고로 매번 다시 계산한다 (저장·재고 변화 즉시 반영)
  const results: Recommendation[] = useMemo(
    () =>
      (resultIds ?? [])
        .map((id) => state.recipes.find((r) => r.id === id))
        .filter((r): r is Recipe => !!r)
        .map((r) => buildRecommendation(state, today, r, opts.servings)),
    [resultIds, state, today, opts.servings],
  );

  const saved = useMemo(
    () => state.recipes.filter((r) => r.saved).map((r) => buildRecommendation(state, today, r, opts.servings)),
    [state, today, opts.servings],
  );

  const toggle = (key: FilterKey) => {
    const next = { ...opts, [key]: !opts[key] };
    setOpts(next);
    if (resultIds) run(next);
  };

  return (
    <>
      <PageHeader title="추천" />
      <div className="px-5">
        <SegmentedControl
          label="레시피 보기"
          value={tab}
          onChange={setTab}
          options={[
            { value: "recommend", label: "추천 받기" },
            { value: "saved", label: "저장한 레시피", count: state.recipes.filter((r) => r.saved).length },
          ]}
        />

        {hasTarget && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-soft py-2.5 pr-2 pl-3.5 text-[14px] text-green-ink">
            <span className="flex-1">
              <b className="font-semibold">
                {formatShortDate(targetDate!)} {MEAL_LABEL[targetMeal!]}
              </b>
              에 넣을 메뉴를 고르는 중
            </span>
            <button
              type="button"
              aria-label="선택 취소"
              onClick={() => router.replace("/recipes", { scroll: false })}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full active:bg-bg/60"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const on = opts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(f.key)}
                className={cn(
                  "inline-flex h-[34px] items-center gap-1 rounded-full border px-3 text-[13.5px] font-medium",
                  on ? "border-ink bg-ink text-white" : "border-line text-[#3c433e] active:bg-subtle",
                )}
              >
                {on && <Check size={14} strokeWidth={2.4} />}
                {f.label}
              </button>
            );
          })}
          <label className="relative inline-flex h-[34px] items-center gap-0.5 rounded-full border border-line px-3 text-[13.5px] font-medium text-[#3c433e]">
            {opts.servings}인분
            <ChevronDown size={14} />
            <select
              aria-label="인분"
              value={opts.servings}
              onChange={(e) => setOpts({ ...opts, servings: Number(e.target.value) })}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}인분
                </option>
              ))}
            </select>
          </label>
        </div>

        {tab === "recommend" ? (
          <div className="mt-4">
            {!resultIds && !loading && (
              <div className="rounded-[14px] bg-subtle px-5 py-6 text-center">
                <Sparkles size={26} strokeWidth={1.5} className="mx-auto text-green" />
                <p className="mt-3 text-[16px] font-semibold">오늘 뭐 먹을까요?</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-sub">
                  보유 재료 {context.owned}개
                  {context.urgent.length > 0 && (
                    <>
                      와 임박 재료 <b className="font-semibold text-warn">{context.urgent.map((s) => s.ingredient.name).join(", ")}</b>
                    </>
                  )}
                  를 반영해 추천해요.
                </p>
                <Button variant="primary" size="lg" block className="mt-5" onClick={() => run(opts)}>
                  추천 받기
                </Button>
              </div>
            )}

            {loading && (
              <div aria-live="polite" aria-busy="true" className="space-y-3">
                <p className="text-[14px] text-sub">보유 재료와 소비기한을 살펴보는 중…</p>
                {[0, 1].map((i) => (
                  <div key={i} className="animate-pulse rounded-[14px] border border-line p-4">
                    <div className="h-3 w-40 rounded bg-subtle" />
                    <div className="mt-3 h-5 w-56 rounded bg-subtle" />
                    <div className="mt-3 flex gap-1.5">
                      <div className="h-6 w-14 rounded-full bg-subtle" />
                      <div className="h-6 w-16 rounded-full bg-subtle" />
                      <div className="h-6 w-12 rounded-full bg-subtle" />
                    </div>
                    <div className="mt-4 h-10 rounded bg-subtle" />
                  </div>
                ))}
              </div>
            )}

            {!loading && resultIds && (
              <div className="space-y-3">
                {results.length === 0 ? (
                  <EmptyState title="조건에 맞는 메뉴가 없어요" description="필터를 줄여 다시 시도해 보세요." />
                ) : (
                  results.map((r) => <RecipeCard key={r.recipe.id} rec={r} servings={opts.servings} onAdd={() => setAdding(r.recipe)} />)
                )}
                <Button variant="dashed" size="md" block icon={<RefreshCw size={16} />} onClick={() => run(opts, true)}>
                  다른 메뉴 추천 받기
                </Button>
                <p className="pt-1 text-center text-[12px] leading-relaxed text-mute">
                  AI 연결 전 미리보기 — 예시 레시피 중에서 보유 재료 기준으로 골라요.
                  <br />
                  원가·영양은 재고 데이터로 앱이 직접 계산해요.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {saved.length === 0 ? (
              <EmptyState title="저장한 레시피가 없어요" description="추천 카드의 책갈피를 눌러 저장해 보세요." />
            ) : (
              saved.map((r) => <RecipeCard key={r.recipe.id} rec={r} servings={opts.servings} onAdd={() => setAdding(r.recipe)} />)
            )}
          </div>
        )}
      </div>

      {adding && (
        <AddToPlanSheet
          recipe={adding}
          open
          onClose={() => setAdding(null)}
          initialDate={targetDate}
          initialMeal={targetMeal}
          initialServings={opts.servings > 3 ? 3 : opts.servings}
          onAdded={hasTarget ? () => router.push(`/planner?date=${targetDate}`) : undefined}
        />
      )}
    </>
  );
}
