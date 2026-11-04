"use client";

import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { QuantityField } from "@/components/ui/QuantityField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { CategoryPicker } from "@/features/inventory/CategoryPicker";
import { cn } from "@/lib/cn";
import { guessCategory, suggestStorage } from "@/lib/domain/category";
import { formatUnitPrice, formatWon, STORAGE_LABEL, STORAGE_ORDER } from "@/lib/domain/units";
import type { BaseUnit, DraftItem, Ingredient } from "@/lib/domain/types";
import { itemFinalPrice, itemUnitCost } from "@/lib/receipt/draft";
import { useKitchen } from "@/lib/store/kitchen-store";

type Kind = "food" | "nonfood" | "excluded";

const UNIT_OPTIONS: { value: BaseUnit; label: string }[] = [
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "ea", label: "개" },
];

export function ReviewItemSheet({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: DraftItem | null;
  onClose: () => void;
  onSave: (item: DraftItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Sheet open={!!item} onClose={onClose} title="품목 확인" description={item?.rawName || "새 품목"}>
      {item && <Body key={item.id} initial={item} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  );
}

function Body({ initial, onSave, onDelete }: { initial: DraftItem; onSave: (i: DraftItem) => void; onDelete: (id: string) => void }) {
  const { state } = useKitchen();
  const [it, setIt] = useState<DraftItem>(initial);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(!initial.ingredientId);
  const set = (patch: Partial<DraftItem>) => setIt((p) => ({ ...p, ...patch }));

  const kind: Kind = !it.include ? "excluded" : it.isFood ? "food" : "nonfood";
  const linked = it.ingredientId ? state.ingredients.find((i) => i.id === it.ingredientId) : undefined;
  const unitRef: Pick<Ingredient, "baseUnit" | "eaLabel"> = linked ?? { baseUnit: it.newUnit };

  const candidates = useMemo(() => {
    const q = query.trim();
    const words = it.newName.split(" ").filter((w) => w.length >= 2);
    return state.ingredients
      .filter((i) => (q ? i.name.includes(q) : words.some((w) => i.name.includes(w) || w.includes(i.name))))
      .slice(0, 12);
  }, [state.ingredients, query, it.newName]);

  const pickExisting = (ing: Ingredient) => {
    // 단위가 바뀌면 수량을 다시 확인해야 한다
    set({
      ingredientId: ing.id,
      matchedBy: "user",
      newUnit: ing.baseUnit,
      storage: ing.defaultStorage,
      quantity: ing.baseUnit === unitRef.baseUnit ? it.quantity : null,
    });
    setPicking(false);
    setQuery("");
  };

  const useNew = () => {
    const name = (query.trim() || it.newName).trim();
    const cat = guessCategory(name) ?? it.newCategory;
    set({ ingredientId: null, matchedBy: null, newName: name, newCategory: cat, storage: suggestStorage(name, cat) ?? it.storage });
    setPicking(false);
    setQuery("");
  };

  const unitCost = itemUnitCost(it);
  const num = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^0-9]/g, "")) || 0));
  const field = "h-11 w-full min-w-0 rounded-xl border border-line px-3 outline-none focus:border-green";
  const canSave = kind !== "food" || ((!!it.ingredientId || !!it.newName.trim()) && (it.quantity ?? 0) > 0);

  return (
    <div className="space-y-5 pt-2">
      <label className="block">
        <span className="mb-1.5 block text-[13px] text-sub">영수증 표기</span>
        <input value={it.rawName} onChange={(e) => set({ rawName: e.target.value })} placeholder="예: 국산콩 두부 300g" className={field} />
      </label>

      <SegmentedControl
        label="품목 종류"
        value={kind}
        onChange={(k) => set({ include: k !== "excluded", isFood: k === "excluded" ? it.isFood : k === "food" })}
        options={[
          { value: "food", label: "식품 (재고 등록)" },
          { value: "nonfood", label: "식품 아님" },
          { value: "excluded", label: "제외" },
        ]}
      />

      {kind === "food" && (
        <>
          <section>
            <p className="mb-1.5 text-[13px] text-sub">식재료</p>
            {!picking ? (
              <div className="flex h-12 items-center justify-between rounded-xl border border-green bg-green-soft px-4">
                <span className="flex min-w-0 items-center gap-2">
                  <b className="truncate text-[16px] font-semibold text-green-ink">{linked?.name ?? it.newName}</b>
                  {!linked && <Badge tone="gray">새 식재료</Badge>}
                </span>
                <button type="button" className="shrink-0 text-[14px] font-medium text-sub" onClick={() => setPicking(true)}>
                  변경
                </button>
              </div>
            ) : (
              <div>
                <div className="flex h-11 items-center gap-2 rounded-xl bg-subtle px-3.5 text-mute">
                  <Search size={17} className="shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="기존 재료 검색 또는 새 이름"
                    aria-label="식재료 검색"
                    className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mute"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickExisting(c)}
                      className="h-8 rounded-full border border-line px-3 text-[13.5px] active:bg-subtle"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={useNew}
                  disabled={!(query.trim() || it.newName.trim())}
                  className="mt-2 flex h-11 w-full items-center justify-between rounded-xl border border-dashed border-line-strong px-3.5 text-left text-[14px] disabled:opacity-50"
                >
                  <span>
                    새 식재료로 등록: <b className="font-semibold">‘{(query.trim() || it.newName).trim() || "이름 입력"}’</b>
                  </span>
                  <Check size={16} className="text-green" />
                </button>
              </div>
            )}
            {!picking && !linked && (
              <div className="mt-3 space-y-3 rounded-xl bg-subtle p-3">
                <label className="block">
                  <span className="mb-1 block text-[12.5px] text-sub">이름</span>
                  <input value={it.newName} onChange={(e) => set({ newName: e.target.value })} className={`${field} bg-bg`} />
                </label>
                <div>
                  <span className="mb-1 block text-[12.5px] text-sub">기준 단위</span>
                  <SegmentedControl
                    className="bg-bg"
                    label="기준 단위"
                    options={UNIT_OPTIONS}
                    value={it.newUnit}
                    onChange={(u) => set({ newUnit: u, quantity: u === it.newUnit ? it.quantity : null })}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-[12.5px] text-sub">분류</span>
                  <CategoryPicker value={it.newCategory} onChange={(c) => set({ newCategory: c })} />
                </div>
              </div>
            )}
          </section>

          <section>
            <QuantityField
              label={`총 수량 · 영수증 표기 ${it.quantityText}`}
              ingredient={unitRef}
              value={it.quantity ?? 0}
              onChange={(v) => set({ quantity: v })}
            />
            {!it.quantity && (
              <p className="mt-1.5 text-[12.5px] text-warn">
                용량이 적혀 있지 않거나 단위가 달라요. 실제 양을 {unitRef.baseUnit === "ea" ? "개수" : unitRef.baseUnit}로 입력해 주세요.
              </p>
            )}
          </section>

          <section>
            <p className="mb-1.5 text-[13px] text-sub">보관 위치</p>
            <SegmentedControl
              label="보관 위치"
              options={STORAGE_ORDER.map((l) => ({ value: l, label: STORAGE_LABEL[l] }))}
              value={it.storage}
              onChange={(s) => set({ storage: s })}
            />
          </section>

          <section>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[13px] text-sub">
                소비기한
                {it.expiryFromImage && <Badge tone="warn">이미지에서 읽음 · 확인 필요</Badge>}
              </span>
              <input
                type="date"
                value={it.expiryDate ?? ""}
                onChange={(e) => set({ expiryDate: e.target.value || null, expiryFromImage: false })}
                className={cn(field, "appearance-none bg-bg text-left [&::-webkit-date-and-time-value]:text-left", !it.expiryDate && "text-mute")}
              />
            </label>
            {it.expiryFromImage ? (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => set({ expiryFromImage: false })} icon={<Check size={15} />}>
                  포장과 같아요
                </Button>
                <Button size="sm" variant="ghost" onClick={() => set({ expiryDate: null, expiryFromImage: false })}>
                  지우기
                </Button>
              </div>
            ) : (
              <p className="mt-1.5 text-[12px] text-mute">포장에 표기된 날짜만 입력하세요. 비워 두면 추정하지 않아요.</p>
            )}
          </section>
        </>
      )}

      {kind !== "excluded" && (
        <section className="grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[13px] text-sub">금액 (원)</span>
            <input inputMode="numeric" value={String(it.linePrice || "")} onChange={(e) => set({ linePrice: num(e.target.value) })} placeholder="0" className={field} />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[13px] text-sub">품목 할인 (원)</span>
            <input inputMode="numeric" value={String(it.lineDiscount || "")} onChange={(e) => set({ lineDiscount: num(e.target.value) })} placeholder="0" className={field} />
          </label>
          <p className="col-span-2 -mt-1 text-[12.5px] text-sub">
            할인 후 {formatWon(itemFinalPrice(it))}
            {it.allocatedDiscount > 0 && ` (주문 할인 ${formatWon(it.allocatedDiscount)} 배분 포함)`}
            {kind === "food" && unitCost != null && ` · ${formatUnitPrice(unitCost, unitRef)}`}
          </p>
        </section>
      )}

      <div className="grid grid-cols-[96px_1fr] gap-2 pt-1">
        <Button variant="danger" size="lg" onClick={() => onDelete(it.id)}>
          삭제
        </Button>
        <Button variant="primary" size="lg" disabled={!canSave} onClick={() => onSave(it)}>
          완료
        </Button>
      </div>
    </div>
  );
}
