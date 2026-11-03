"use client";

import { Check, ChevronRight, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { QuantityField } from "@/components/ui/QuantityField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/date";
import { stockOf } from "@/lib/domain/stock";
import { formatQuantity, formatWon } from "@/lib/domain/units";
import type { ISODate, MealType } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { uid } from "@/lib/store/reducer";
import { MEAL_LABEL, MEAL_TYPES, recipeCost } from "@/lib/store/selectors";
import { mealFromRecipe } from "./build";

type Mode = "recipe" | "manual";

export function AddMealSheet({
  open,
  onClose,
  date,
  mealType,
}: {
  open: boolean;
  onClose: () => void;
  date: ISODate;
  mealType: MealType;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="메뉴 추가" description={formatShortDate(date)}>
      {open && <AddMealBody date={date} initialType={mealType} onDone={onClose} />}
    </Sheet>
  );
}

function AddMealBody({ date, initialType, onDone }: { date: ISODate; initialType: MealType; onDone: () => void }) {
  const { state, dispatch } = useKitchen();
  const toast = useToast();
  const [mealType, setMealType] = useState<MealType>(initialType);
  const [mode, setMode] = useState<Mode>("recipe");
  const saved = state.recipes.filter((r) => r.saved);

  const addRecipe = (recipeId: string) => {
    const recipe = state.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    dispatch({ type: "addMeal", meal: mealFromRecipe(recipe, date, mealType, 1, "recipe") });
    toast(`${MEAL_LABEL[mealType]}에 추가했어요 · ${recipe.title}`);
    onDone();
  };

  return (
    <div>
      <SegmentedControl
        label="끼니"
        options={MEAL_TYPES.map((t) => ({ value: t, label: MEAL_LABEL[t] }))}
        value={mealType}
        onChange={setMealType}
      />

      <Link
        href={`/recipes?date=${date}&meal=${mealType}`}
        className="mt-3 flex items-center gap-3 rounded-[14px] bg-green-soft px-4 py-3.5 active:opacity-80"
      >
        <Sparkles size={20} className="text-green" strokeWidth={1.75} />
        <span className="flex-1">
          <b className="block text-[15px] font-semibold text-green-ink">AI 추천에서 고르기</b>
          <span className="text-[13px] text-[#56715d]">보유 재료와 소비기한을 반영해 추천해요</span>
        </span>
        <ChevronRight size={18} className="text-[#56715d]" />
      </Link>

      <div className="mt-5 flex gap-5 border-b border-line">
        {(
          [
            ["recipe", "저장한 레시피"],
            ["manual", "직접 입력"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "-mb-px h-10 border-b-2 text-[15px]",
              mode === m ? "border-ink font-semibold text-ink" : "border-transparent font-medium text-mute",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "recipe" ? (
        <ul className="divide-y divide-line">
          {saved.length === 0 && <li className="py-6 text-center text-[14px] text-sub">저장한 레시피가 없어요</li>}
          {saved.map((r) => {
            const cost = recipeCost(state, r, 1);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => addRecipe(r.id)}
                  className="flex w-full items-center gap-3 py-3.5 text-left active:bg-subtle"
                >
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15.5px] font-semibold">{r.title}</b>
                    <span className="text-[13px] text-sub">
                      {r.cookMinutes}분 · 예상 {formatWon(cost.total)}
                    </span>
                  </span>
                  <span className="text-[14px] font-semibold text-green">추가</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ManualMealForm date={date} mealType={mealType} onDone={onDone} />
      )}
    </div>
  );
}

function ManualMealForm({ date, mealType, onDone }: { date: ISODate; mealType: MealType; onDone: () => void }) {
  const { state, dispatch } = useKitchen();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});

  const candidates = useMemo(() => {
    const q = query.trim();
    return state.ingredients
      .filter((i) => !q || i.name.includes(q))
      .map((i) => ({ ing: i, stock: stockOf(state.lots, i.id) }))
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0))
      .slice(0, 12);
  }, [state.ingredients, state.lots, query]);

  const toggle = (id: string, unit: string) => {
    setPicked((p) => {
      if (id in p) {
        const next = { ...p };
        delete next[id];
        return next;
      }
      return { ...p, [id]: unit === "ea" ? 1 : 100 };
    });
  };

  const save = () => {
    const name = title.trim();
    if (!name) return;
    dispatch({
      type: "addMeal",
      meal: {
        id: uid("meal"),
        date,
        mealType,
        title: name,
        recipeId: null,
        source: "manual",
        servings: 1,
        items: Object.entries(picked)
          .filter(([, q]) => q > 0)
          .map(([ingredientId, q]) => ({ id: uid("mi"), ingredientId, plannedQuantity: q })),
      },
    });
    toast(`${MEAL_LABEL[mealType]}에 추가했어요 · ${name}`);
    onDone();
  };

  return (
    <div className="pt-4">
      <label className="block text-[13px] text-sub" htmlFor="meal-title">
        메뉴 이름
      </label>
      <input
        id="meal-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="예: 김치볶음밥"
        className="mt-1.5 h-12 w-full rounded-xl border border-line px-4 outline-none placeholder:text-mute focus:border-green"
      />

      <p className="mt-5 text-[13px] text-sub">사용할 재료 (선택)</p>
      <div className="mt-1.5 flex h-11 items-center gap-2 rounded-xl bg-subtle px-3.5 text-mute">
        <Search size={17} className="shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="재료 검색"
          className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mute"
        />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {candidates.map(({ ing, stock }) => {
          const on = ing.id in picked;
          return (
            <button
              key={ing.id}
              type="button"
              onClick={() => toggle(ing.id, ing.baseUnit)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13.5px]",
                on ? "border-ink bg-ink text-white" : "border-line text-ink",
                !on && stock === 0 && "text-mute",
              )}
            >
              {on && <Check size={14} />}
              {ing.name}
            </button>
          );
        })}
      </div>

      {Object.keys(picked).length > 0 && (
        <ul className="mt-4 space-y-3">
          {Object.entries(picked).map(([id, q]) => {
            const ing = state.ingredients.find((i) => i.id === id);
            if (!ing) return null;
            return (
              <li key={id}>
                <div className="mb-1.5 flex items-center justify-between text-[13.5px]">
                  <span className="font-semibold">{ing.name}</span>
                  <span className="flex items-center gap-2 text-sub">
                    보유 {formatQuantity(stockOf(state.lots, id), ing)}
                    <button type="button" aria-label={`${ing.name} 빼기`} onClick={() => toggle(id, ing.baseUnit)}>
                      <X size={16} />
                    </button>
                  </span>
                </div>
                <QuantityField ingredient={ing} value={q} onChange={(v) => setPicked((p) => ({ ...p, [id]: v }))} />
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="primary" size="lg" block className="mt-5" disabled={!title.trim()} onClick={save}>
        식단에 추가
      </Button>
    </div>
  );
}
