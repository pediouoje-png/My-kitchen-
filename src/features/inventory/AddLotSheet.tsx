"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { QuantityField } from "@/components/ui/QuantityField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatUnitPrice, STORAGE_LABEL, STORAGE_ORDER } from "@/lib/domain/units";
import type { BaseUnit, Ingredient, StorageLocation } from "@/lib/domain/types";
import { guessCategory, suggestStorage } from "@/lib/domain/category";
import { useKitchen } from "@/lib/store/kitchen-store";
import { uid } from "@/lib/store/reducer";
import { CategoryPicker } from "./CategoryPicker";

/** 재고 직접 등록 (선물·텃밭·영수증 없는 구매 등). purchase_item 없이 로트만 생성한다. */
export function AddLotSheet({
  open,
  onClose,
  defaultStorage,
  presetIngredientId,
}: {
  open: boolean;
  onClose: () => void;
  defaultStorage: StorageLocation;
  presetIngredientId?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="재료 직접 등록" description="영수증 없이 재고를 추가해요">
      {open && <AddLotBody defaultStorage={defaultStorage} presetIngredientId={presetIngredientId} onDone={onClose} />}
    </Sheet>
  );
}

const UNIT_OPTIONS: { value: BaseUnit; label: string }[] = [
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "ea", label: "개" },
];

function AddLotBody({
  defaultStorage,
  presetIngredientId,
  onDone,
}: {
  defaultStorage: StorageLocation;
  presetIngredientId?: string;
  onDone: () => void;
}) {
  const { state, dispatch, today } = useKitchen();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [ingredientId, setIngredientId] = useState<string | null>(presetIngredientId ?? null);
  const [newUnit, setNewUnit] = useState<BaseUnit>("g");
  const [qty, setQty] = useState(() => {
    const preset = presetIngredientId ? state.ingredients.find((i) => i.id === presetIngredientId) : undefined;
    return preset?.baseUnit === "ea" ? 1 : 100;
  });
  const [pickedStorage, setPickedStorage] = useState<StorageLocation | null>(null);
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState("");

  const name = query.trim();
  // 이름이 기존 재료와 정확히 같으면 새로 만들지 않고 그 재료를 쓴다
  const selected = ingredientId ? state.ingredients.find((i) => i.id === ingredientId) : undefined;
  const exactMatch = selected ? undefined : state.ingredients.find((i) => i.name === name);
  const existing = selected ?? exactMatch;
  const isNew = !existing && name.length > 0;
  const guessed = isNew ? guessCategory(name) : null;
  const category = pickedCategory ?? guessed ?? "기타";
  const storage: StorageLocation =
    pickedStorage ?? existing?.defaultStorage ?? (isNew ? suggestStorage(name, category) : null) ?? defaultStorage;
  const setStorage = setPickedStorage;
  const unitRef: Pick<Ingredient, "baseUnit" | "eaLabel"> = existing ?? { baseUnit: newUnit };

  const matches = useMemo(
    () => state.ingredients.filter((i) => !name || i.name.includes(name)).slice(0, 10),
    [state.ingredients, name],
  );

  const pick = (ing: Ingredient) => {
    setIngredientId(ing.id);
    setPickedStorage(null);
    setQty(ing.baseUnit === "ea" ? 1 : 100);
  };

  const priceNum = Number(price.replace(/[^0-9]/g, ""));
  const unitCost = priceNum > 0 && qty > 0 ? priceNum / qty : null;
  const canSave = (existing || isNew) && qty > 0;

  const save = () => {
    let ingId = existing?.id;
    if (!ingId) {
      ingId = uid("ing");
      dispatch({
        type: "addIngredient",
        ingredient: { id: ingId, name, category, baseUnit: newUnit, defaultStorage: storage, storageDays: {}, nutrition: null },
      });
    }
    dispatch({
      type: "addLot",
      lot: {
        id: uid("lot"),
        ingredientId: ingId,
        storage,
        quantity: qty,
        unitCost,
        acquiredOn: today,
        expiryDate: expiry || null,
        sourceLabel: null,
      },
    });
    toast(`${STORAGE_LABEL[storage]}에 등록했어요 · ${existing?.name ?? name}`, { label: "보기", href: `/fridge/${ingId}` });
    onDone();
  };

  return (
    <div className="space-y-5 pt-2">
      <div>
        <p className="mb-1.5 text-[13px] text-sub">재료</p>
        {selected ? (
          <div className="flex h-12 items-center justify-between rounded-xl border border-green bg-green-soft px-4">
            <b className="text-[16px] font-semibold text-green-ink">{selected.name}</b>
            {!presetIngredientId && (
              <button
                type="button"
                className="text-[14px] font-medium text-sub"
                onClick={() => {
                  setIngredientId(null);
                  setQuery("");
                }}
              >
                변경
              </button>
            )}
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름으로 찾거나 새로 입력"
              className="h-12 w-full rounded-xl border border-line px-4 outline-none placeholder:text-mute focus:border-green"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {matches.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => pick(i)}
                  className="h-8 rounded-full border border-line px-3 text-[13.5px] active:bg-subtle"
                >
                  {i.name}
                </button>
              ))}
            </div>
            {exactMatch && (
              <p className="mt-2 text-[13px] text-sub">
                이미 있는 ‘<b className="text-ink">{exactMatch.name}</b>’ 재고로 추가돼요.
              </p>
            )}
            {isNew && (
              <div className="mt-3 rounded-xl bg-subtle p-3">
                <p className="text-[13px] text-sub">
                  ‘<b className="text-ink">{name}</b>’을 새 식재료로 만들어요. 기준 단위를 골라 주세요.
                </p>
                <SegmentedControl className="mt-2 bg-bg" label="단위" options={UNIT_OPTIONS}
                  value={newUnit}
                  onChange={(u) => {
                    setNewUnit(u);
                    setQty(u === "ea" ? 1 : 100);
                  }}
                />
                <p className="mt-3 mb-1.5 text-[13px] text-sub">
                  분류{guessed && !pickedCategory && <span className="text-mute"> · 이름으로 추천했어요</span>}
                </p>
                <CategoryPicker value={category} onChange={setPickedCategory} />
              </div>
            )}
          </>
        )}
      </div>

      <QuantityField label="수량" ingredient={unitRef} value={qty} onChange={setQty} />

      <div>
        <p className="mb-1.5 text-[13px] text-sub">보관 위치</p>
        <SegmentedControl
          label="보관 위치"
          options={STORAGE_ORDER.map((l) => ({ value: l, label: STORAGE_LABEL[l] }))}
          value={storage}
          onChange={setStorage}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] text-sub">구매 금액 (선택)</span>
          <span className="flex h-12 items-center rounded-xl border border-line px-3.5 focus-within:border-green">
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-mute"
            />
            <span className="text-[14px] text-sub">원</span>
          </span>
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[13px] text-sub">소비기한 (선택)</span>
          <input
            type="date"
            value={expiry}
            min={today}
            onChange={(e) => setExpiry(e.target.value)}
            className={cn(
              "h-12 w-full min-w-0 appearance-none rounded-xl border border-line bg-bg px-3 text-left outline-none focus:border-green [&::-webkit-date-and-time-value]:text-left",
              !expiry && "text-mute",
            )}
          />
        </label>
      </div>
      <p className="-mt-2 text-[12.5px] leading-relaxed text-sub">
        {unitCost != null && <>단위 가격 {formatUnitPrice(unitCost, unitRef)} · </>}
        소비기한은 포장에 표기된 날짜만 입력하세요. 비워 두면 추정하지 않아요.
      </p>

      <Button variant="primary" size="lg" block disabled={!canSave} onClick={save} icon={<Check size={18} />}>
        등록
      </Button>
    </div>
  );
}
