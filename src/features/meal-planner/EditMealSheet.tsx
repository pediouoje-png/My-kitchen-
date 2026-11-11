"use client";

import { Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { QuantityField } from "@/components/ui/QuantityField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { stockOf } from "@/lib/domain/stock";
import { formatQuantity } from "@/lib/domain/units";
import type { MealPlan } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { uid } from "@/lib/store/reducer";

interface Row {
  id: string;
  ingredientId: string;
  quantity: number;
}

/**
 * 식단 수정: 메뉴 이름 · 인분 · 재료(수량 조절 · 빼기 · 추가).
 * 완료한 식사는 재고가 이미 차감됐으므로 완료를 취소한 뒤 수정한다.
 */
export function EditMealSheet({ meal, open, onClose }: { meal: MealPlan; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="식단 수정" description={meal.title}>
      {open && <EditBody key={meal.id} meal={meal} onDone={onClose} />}
    </Sheet>
  );
}

function EditBody({ meal, onDone }: { meal: MealPlan; onDone: () => void }) {
  const { state, dispatch, today } = useKitchen();
  const toast = useToast();
  const recipe = meal.recipeId ? state.recipes.find((r) => r.id === meal.recipeId) : undefined;
  const [title, setTitle] = useState(meal.title);
  const [servings, setServings] = useState(String(meal.servings));
  const [rows, setRows] = useState<Row[]>(meal.items.map((i) => ({ id: i.id, ingredientId: i.ingredientId, quantity: i.plannedQuantity })));
  const [query, setQuery] = useState("");
  // 직접 만든 레시피와 연결돼 있으면 재료 변경을 레시피에도 반영할지 고른다
  const canSyncRecipe = recipe?.source === "user";
  const [syncRecipe, setSyncRecipe] = useState(canSyncRecipe);
  // 훅은 아래의 조기 반환보다 먼저 호출해야 한다 (완료 취소 직후 같은 컴포넌트가 다시 그려짐)
  const candidates = useCandidates(query, rows);

  if (meal.status === "done") {
    return (
      <div className="space-y-4 pt-2">
        <p className="rounded-xl bg-subtle px-4 py-3 text-[14px] leading-relaxed text-sub">
          이미 완료한 식사라 재고에서 차감됐어요. 완료를 취소하면 재고가 되돌아가고, 그다음 재료를 고칠 수 있어요.
        </p>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            dispatch({ type: "undoMeal", mealId: meal.id, on: today });
            toast("완료를 취소했어요. 이제 수정할 수 있어요");
          }}
        >
          완료 취소하고 수정하기
        </Button>
      </div>
    );
  }

  const add = (ingredientId: string, baseUnit: string) => {
    setRows((r) => [...r, { id: uid("mi"), ingredientId, quantity: baseUnit === "ea" ? 1 : 100 }]);
    setQuery("");
  };

  const n = Number(servings);
  const valid = title.trim().length > 0 && rows.every((r) => r.quantity > 0);

  const save = () => {
    const items = rows.map((r) => ({ id: r.id, ingredientId: r.ingredientId, plannedQuantity: r.quantity }));
    dispatch({ type: "updateMeal", mealId: meal.id, patch: { title: title.trim(), servings: n, items } });
    if (canSyncRecipe && syncRecipe && recipe) {
      // 레시피는 1인분 기준으로 저장되지 않을 수 있으므로 레시피 인분에 맞춰 환산한다
      const ratio = recipe.servings / n;
      const unlinked = recipe.ingredients.filter((i) => !i.ingredientId);
      dispatch({
        type: "updateRecipe",
        id: recipe.id,
        patch: {
          title: title.trim(),
          ingredients: [
            ...rows.flatMap((r) => {
              const ing = state.ingredients.find((i) => i.id === r.ingredientId);
              if (!ing) return [];
              const q = Number((r.quantity * ratio).toFixed(3));
              const prev = recipe.ingredients.find((i) => i.ingredientId === ing.id);
              return [{ ingredientId: ing.id, name: ing.name, quantity: q, displayText: `${ing.name} ${formatQuantity(q, ing)}`, optional: prev?.optional }];
            }),
            ...unlinked, // "소금 약간" 같은 재고 없는 항목은 그대로 둔다
          ],
        },
      });
    }
    toast(canSyncRecipe && syncRecipe ? "식단과 내 레시피를 수정했어요" : "식단을 수정했어요");
    onDone();
  };

  return (
    <div className="space-y-5 pt-2">
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-sub">메뉴 이름</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="메뉴 이름"
          className="h-12 w-full rounded-xl border border-line px-4 outline-none focus:border-green"
        />
      </label>

      <div>
        <p className="mb-1.5 text-[13px] text-sub">인분</p>
        <SegmentedControl
          label="인분"
          options={["1", "2", "3", "4"].map((s) => ({ value: s, label: `${s}인분` }))}
          value={["1", "2", "3", "4"].includes(servings) ? servings : "1"}
          onChange={(v) => {
            // 인분을 바꾸면 재료 양도 같은 비율로 바꾼다
            const ratio = Number(v) / n;
            setRows((r) => r.map((x) => ({ ...x, quantity: Number((x.quantity * ratio).toFixed(3)) })));
            setServings(v);
          }}
        />
      </div>

      <section>
        <p className="mb-1.5 text-[13px] text-sub">재료 {rows.length}개</p>
        {rows.length === 0 && <p className="rounded-xl bg-subtle px-4 py-3 text-[13.5px] text-sub">아래에서 재료를 찾아 추가해 주세요.</p>}
        <ul className="space-y-3">
          {rows.map((r) => {
            const ing = state.ingredients.find((i) => i.id === r.ingredientId);
            if (!ing) return null;
            return (
              <li key={r.id}>
                <div className="mb-1.5 flex items-center justify-between text-[13.5px]">
                  <span className="font-semibold">{ing.name}</span>
                  <span className="flex items-center gap-2 text-sub">
                    보유 {formatQuantity(stockOf(state.lots, ing.id), ing)}
                    <button
                      type="button"
                      aria-label={`${ing.name} 빼기`}
                      onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full active:bg-subtle"
                    >
                      <X size={16} />
                    </button>
                  </span>
                </div>
                <QuantityField ingredient={ing} value={r.quantity} onChange={(v) => setRows((x) => x.map((y) => (y.id === r.id ? { ...y, quantity: v } : y)))} />
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <p className="mb-1.5 text-[13px] text-sub">재료 추가</p>
        <div className="flex h-11 items-center gap-2 rounded-xl bg-subtle px-3.5 text-mute">
          <Search size={17} className="shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="재료 검색"
            aria-label="추가할 재료 검색"
            className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mute"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {candidates.map(({ ing, stock }) => (
            <button
              key={ing.id}
              type="button"
              onClick={() => add(ing.id, ing.baseUnit)}
              className={cn("inline-flex h-8 items-center gap-1 rounded-full border border-line px-3 text-[13.5px] active:bg-subtle", stock === 0 && "text-mute")}
            >
              + {ing.name}
            </button>
          ))}
          {candidates.length === 0 && <span className="text-[13px] text-sub">맞는 재료가 없어요. 냉장고에서 먼저 등록해 주세요.</span>}
        </div>
      </section>

      {canSyncRecipe && (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-subtle px-3.5 py-3">
          <input
            type="checkbox"
            checked={syncRecipe}
            onChange={(e) => setSyncRecipe(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--color-green)]"
          />
          <span className="text-[14px]">
            <b className="block font-semibold">내 레시피에도 반영</b>
            <span className="text-[12.5px] text-sub">다음에 이 메뉴를 추가할 때도 바뀐 재료로 들어가요</span>
          </span>
        </label>
      )}

      <Button variant="primary" size="lg" block disabled={!valid} onClick={save} icon={<Check size={18} />}>
        저장
      </Button>
    </div>
  );
}

function useCandidates(query: string, rows: Row[]) {
  const { state } = useKitchen();
  return useMemo(() => {
    const picked = new Set(rows.map((r) => r.ingredientId));
    const q = query.trim();
    return state.ingredients
      .filter((i) => !picked.has(i.id) && (!q || i.name.includes(q)))
      .map((ing) => ({ ing, stock: stockOf(state.lots, ing.id) }))
      .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.ing.name.localeCompare(b.ing.name, "ko"))
      .slice(0, q ? 24 : 15);
  }, [state.ingredients, state.lots, query, rows]);
}
