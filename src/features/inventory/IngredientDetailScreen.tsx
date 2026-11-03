"use client";

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ExpiryBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/misc";
import { DetailHeader, SectionHeader } from "@/components/ui/PageHeader";
import { formatMD, formatShortDate, relativeDayLabel } from "@/lib/date";
import { fifoOrder } from "@/lib/domain/costing";
import { EXPIRY_SOURCE_LABEL, lotExpiry } from "@/lib/domain/expiry";
import { compareMeals } from "@/lib/domain/stock";
import { formatQuantity, formatUnitPrice, formatWon, STORAGE_LABEL, unitLabel } from "@/lib/domain/units";
import type { ConsumptionReason, InventoryLot } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { MEAL_LABEL } from "@/lib/store/selectors";
import { richMacros } from "@/lib/domain/nutrition";
import { AddLotSheet } from "./AddLotSheet";
import { EditIngredientSheet } from "./EditIngredientSheet";
import { MacroTags } from "./MacroTags";
import { LotActionSheet, type LotAction } from "./LotActionSheet";

const REASON_LABEL: Record<ConsumptionReason, string> = { meal: "식사", manual: "사용", discard: "폐기", adjust: "되돌림" };

export function IngredientDetailScreen() {
  const { ingredientId } = useParams<{ ingredientId: string }>();
  const { state, today } = useKitchen();
  const [target, setTarget] = useState<{ lot: InventoryLot; action: LotAction } | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const ing = state.ingredients.find((i) => i.id === ingredientId);

  if (!ing) {
    return (
      <>
        <DetailHeader title="식재료" fallbackHref="/fridge" />
        <EmptyState title="식재료를 찾을 수 없어요" action={<Link href="/fridge" className="font-semibold text-green">냉장고로 돌아가기</Link>} />
      </>
    );
  }

  const soonDays = state.settings.soonDays;
  const lots = state.lots.filter((l) => l.ingredientId === ing.id);
  const active = lots.filter((l) => l.status === "active" && l.qtyRemaining > 0).sort(fifoOrder);
  const total = active.reduce((s, l) => s + l.qtyRemaining, 0);
  const priceHistory = lots.filter((l) => l.unitCost != null).sort((a, b) => (a.acquiredOn < b.acquiredOn ? 1 : -1));
  const planned = state.meals
    .filter((m) => m.status === "planned" && m.items.some((i) => i.ingredientId === ing.id))
    .sort(compareMeals);
  const logs = state.logs
    .filter((l) => l.ingredientId === ing.id)
    .slice(-6)
    .reverse();
  const rich = richMacros(ing);
  const storageDays = Object.entries(ing.storageDays) as [keyof typeof STORAGE_LABEL, number][];

  return (
    <div className="pb-10">
      <DetailHeader
        title="식재료"
        fallbackHref="/fridge"
        right={
          <>
            <button type="button" aria-label="정보 수정" onClick={() => setEditing(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle">
              <Pencil size={19} strokeWidth={1.75} />
            </button>
            <button type="button" aria-label="재고 추가" onClick={() => setAdding(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle">
              <Plus size={22} strokeWidth={1.75} />
            </button>
          </>
        }
      />

      <div className="px-5 pt-1">
        <button type="button" onClick={() => setEditing(true)} className="text-[14px] text-sub">
          {ing.category}
          {ing.category === "기타" && <span className="ml-1 text-green">· 분류 지정</span>}
        </button>
        <div className="mt-0.5 flex items-baseline justify-between">
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">{ing.name}</h1>
          <span className="text-[22px] font-bold">{formatQuantity(total, ing)}</span>
        </div>
        {storageDays.length > 0 && (
          <p className="mt-1 text-[13px] text-sub">
            보관 권장 기간 · {storageDays.map(([k, d]) => `${STORAGE_LABEL[k]} ${d}일`).join(" · ")}
          </p>
        )}

        <section className="mt-6">
          <SectionHeader title="재고" right={<span className="text-[13px] text-sub">소비기한 빠른 순</span>} />
          {active.length === 0 ? (
            <div className="rounded-[14px] bg-subtle px-4 py-5 text-center">
              <p className="text-[14px] text-sub">남은 재고가 없어요</p>
              <Button size="sm" className="mt-3" onClick={() => setAdding(true)} icon={<Plus size={16} />}>
                직접 등록
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {active.map((lot) => {
                const exp = lotExpiry(lot, today, soonDays);
                const pct = Math.max(4, Math.round((lot.qtyRemaining / lot.qtyInitial) * 100));
                return (
                  <Card key={lot.id} className="px-4 pt-3.5 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-sub">
                        {STORAGE_LABEL[lot.storage]} · {formatMD(lot.acquiredOn)} {lot.sourceLabel ?? "직접 등록"}
                      </span>
                      <ExpiryBadge info={exp} withPrefix />
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <b className="text-[18px] font-bold">
                        {formatQuantity(lot.qtyRemaining, ing)}
                        <span className="ml-1 text-[13px] font-medium text-mute">/ {formatQuantity(lot.qtyInitial, ing)}</span>
                      </b>
                      <span className="text-[13px] text-sub">{formatUnitPrice(lot.unitCost, ing)}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-green" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 text-[12.5px] text-sub">
                      {lot.expiryDate
                        ? `소비기한 ${formatShortDate(lot.expiryDate)} · ${EXPIRY_SOURCE_LABEL[lot.expirySource ?? "user"]}`
                        : lot.recommendedUseBy
                          ? `소비기한 정보 없음 · 보관 권장 ${formatShortDate(lot.recommendedUseBy)}까지`
                          : "소비기한 정보 없음"}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <Button size="sm" onClick={() => setTarget({ lot, action: "consume" })}>
                        사용
                      </Button>
                      <Button size="sm" onClick={() => setTarget({ lot, action: "move" })}>
                        이동
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setTarget({ lot, action: "discard" })}>
                        폐기
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {planned.length > 0 && (
          <section className="mt-7">
            <SectionHeader title="사용 예정" />
            <ul className="divide-y divide-line">
              {planned.map((m) => {
                const item = m.items.find((i) => i.ingredientId === ing.id)!;
                return (
                  <li key={m.id}>
                    <Link href={`/planner/${m.id}`} className="flex items-center justify-between py-3 active:bg-subtle">
                      <span>
                        <b className="block text-[15px] font-semibold">{m.title}</b>
                        <span className="text-[13px] text-sub">
                          {relativeDayLabel(m.date, today)} {MEAL_LABEL[m.mealType]}
                        </span>
                      </span>
                      <span className="text-[15px]">{formatQuantity(item.plannedQuantity, ing)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-7">
          <SectionHeader title="영양 정보" right={ing.nutrition && <span className="text-[13px] text-sub">{nutritionBasis(ing.nutrition.basis, unitLabel(ing))}</span>} />
          {rich && rich.length > 0 && (
            <p className="mb-2.5 flex items-center gap-1.5 text-[13.5px]">
              <MacroTags macros={rich} size="md" />
              <span className="text-sub">이 풍부해요</span>
            </p>
          )}
          {ing.nutrition ? (
            <div className="grid grid-cols-4 rounded-[14px] bg-subtle px-4 py-3.5 text-center">
              {(
                [
                  ["열량", `${ing.nutrition.kcal}`, "kcal"],
                  ["단백질", `${ing.nutrition.protein}`, "g"],
                  ["지방", `${ing.nutrition.fat}`, "g"],
                  ["탄수화물", `${ing.nutrition.carbs}`, "g"],
                ] as const
              ).map(([k, v, u]) => (
                <div key={k}>
                  <span className="block text-[12px] text-sub">{k}</span>
                  <b className="text-[16px] font-semibold">{v}</b>
                  <span className="ml-0.5 text-[11px] text-sub">{u}</span>
                </div>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="w-full rounded-[14px] bg-subtle px-4 py-4 text-left text-[14px] text-sub active:opacity-80">
              영양 정보 없음 — <b className="font-semibold text-green">포장 라벨 보고 입력하기</b>
            </button>
          )}
        </section>

        {priceHistory.length > 0 && (
          <section className="mt-7">
            <SectionHeader title="가격 이력" />
            <ul className="divide-y divide-line">
              {priceHistory.map((l, i) => {
                const prev = priceHistory[i + 1];
                const diff = prev?.unitCost && l.unitCost ? Math.round(((l.unitCost - prev.unitCost) / prev.unitCost) * 100) : null;
                return (
                  <li key={l.id} className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-sub">
                      {formatMD(l.acquiredOn)} · {l.sourceLabel ?? "직접 등록"}
                    </span>
                    <span>
                      {formatUnitPrice(l.unitCost, ing)}
                      {diff != null && diff !== 0 && (
                        <span className={diff > 0 ? "ml-1.5 text-[12px] text-danger" : "ml-1.5 text-[12px] text-green"}>
                          {diff > 0 ? "▲" : "▼"}
                          {Math.abs(diff)}%
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {logs.length > 0 && (
          <section className="mt-7">
            <SectionHeader title="최근 기록" />
            <ul className="divide-y divide-line">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-2.5 text-[14px]">
                  <span className="text-sub">
                    {formatMD(l.consumedOn)} · {REASON_LABEL[l.reason]}
                  </span>
                  <span className={l.reason === "discard" ? "text-danger" : undefined}>
                    {l.quantity < 0 ? "+" : "−"}
                    {formatQuantity(Math.abs(l.quantity), ing)}
                    {l.unitCost != null && <span className="ml-1.5 text-[12.5px] text-sub">{formatWon(Math.abs(l.cost))}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <LotActionSheet lot={target?.lot ?? null} action={target?.action ?? null} ingredient={ing} onClose={() => setTarget(null)} />
      <EditIngredientSheet ingredient={ing} open={editing} onClose={() => setEditing(false)} />
      <AddLotSheet open={adding} onClose={() => setAdding(false)} defaultStorage={ing.defaultStorage} presetIngredientId={ing.id} />
    </div>
  );
}

function nutritionBasis(basis: "per_100g" | "per_100ml" | "per_ea", unit: string) {
  if (basis === "per_100g") return "100g 기준";
  if (basis === "per_100ml") return "100ml 기준";
  return `1${unit} 기준`;
}
