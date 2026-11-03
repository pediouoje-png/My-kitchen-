"use client";

import { AlertCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { QuantityField } from "@/components/ui/QuantityField";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { allocateFIFO } from "@/lib/domain/costing";
import { stockOf } from "@/lib/domain/stock";
import { formatQuantity, formatWon } from "@/lib/domain/units";
import type { MealPlan } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { ingredientById, MEAL_LABEL } from "@/lib/store/selectors";

/**
 * 식사 완료 확인 시트.
 * 실제 사용량을 조정한 뒤 완료하면 FIFO로 로트를 차감하고 원가를 기록한다.
 * (DB 단계: complete_meal() 트랜잭션)
 */
export function CompleteMealSheet({ meal, open, onClose }: { meal: MealPlan; open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="식사 완료"
      description={`${MEAL_LABEL[meal.mealType]} · ${meal.title}`}
    >
      {open && <CompleteMealBody meal={meal} onDone={onClose} />}
    </Sheet>
  );
}

function CompleteMealBody({ meal, onDone }: { meal: MealPlan; onDone: () => void }) {
  const { state, dispatch, today } = useKitchen();
  const toast = useToast();
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(meal.items.map((i) => [i.ingredientId, i.plannedQuantity])),
  );

  const rows = useMemo(
    () =>
      meal.items.map((item) => {
        const ing = ingredientById(state, item.ingredientId);
        const want = qty[item.ingredientId] ?? item.plannedQuantity;
        const alloc = allocateFIFO(state.lots, item.ingredientId, want);
        return { item, ing, want, stock: stockOf(state.lots, item.ingredientId), alloc };
      }),
    [meal.items, qty, state],
  );
  const cost = rows.reduce((s, r) => s + r.alloc.cost, 0);
  const shortages = rows.filter((r) => r.alloc.shortage > 0);

  const confirm = () => {
    dispatch({ type: "completeMeal", mealId: meal.id, on: meal.date <= today ? meal.date : today, overrides: qty });
    onDone();
    toast(`완료했어요 · 재고 차감 ${formatWon(cost)}`, {
      label: "되돌리기",
      onClick: () => dispatch({ type: "undoMeal", mealId: meal.id, on: today }),
    });
  };

  return (
    <div>
      {rows.length === 0 ? (
        <p className="py-4 text-[14px] text-sub">연결된 식재료가 없어 재고 변화 없이 완료로 표시돼요.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map(({ item, ing, want, stock, alloc }) =>
            ing ? (
              <li key={item.id} className="py-3.5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[15.5px] font-semibold">{ing.name}</span>
                  <span className={alloc.shortage > 0 ? "text-[13px] text-danger" : "text-[13px] text-sub"}>
                    보유 {formatQuantity(stock, ing)}
                    {alloc.shortage > 0 && ` · ${formatQuantity(alloc.shortage, ing)} 부족`}
                  </span>
                </div>
                <QuantityField
                  ingredient={ing}
                  value={want}
                  onChange={(v) => setQty((q) => ({ ...q, [item.ingredientId]: v }))}
                />
              </li>
            ) : null,
          )}
        </ul>
      )}

      <div className="mt-3 rounded-xl bg-subtle px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] text-sub">재고에서 차감될 원가</span>
          <b className="text-[18px] font-bold">{formatWon(cost)}</b>
        </div>
        <p className="mt-1 text-[12.5px] text-mute">소비기한이 빠른 재고부터 차감해요</p>
      </div>

      {shortages.length > 0 && (
        <p className="mt-3 flex gap-1.5 text-[13px] leading-relaxed text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          재고가 부족한 재료 {shortages.length}개는 있는 만큼만 차감하고 부족분을 기록해요.
        </p>
      )}

      <Button variant="primary" size="lg" block className="mt-4" onClick={confirm}>
        완료하고 재고 차감
      </Button>
    </div>
  );
}
