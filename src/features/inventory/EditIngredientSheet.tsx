"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { STORAGE_LABEL, STORAGE_ORDER, unitLabel } from "@/lib/domain/units";
import type { Ingredient, Nutrition, StorageLocation } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { CategoryPicker } from "./CategoryPicker";

/** 식재료 기본 정보 수정: 분류 · 기본 보관 위치 · 보관 권장 기간 · 영양 정보 */
export function EditIngredientSheet({ ingredient, open, onClose }: { ingredient: Ingredient; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="식재료 정보 수정" description={ingredient.name}>
      {open && <EditBody ingredient={ingredient} onDone={onClose} />}
    </Sheet>
  );
}

type NutKey = "kcal" | "protein" | "fat" | "carbs";
const NUT_FIELDS: { key: NutKey; label: string; unit: string }[] = [
  { key: "kcal", label: "열량", unit: "kcal" },
  { key: "carbs", label: "탄수화물", unit: "g" },
  { key: "protein", label: "단백질", unit: "g" },
  { key: "fat", label: "지방", unit: "g" },
];

function toText(v: number | undefined) {
  return v == null ? "" : String(v);
}

function EditBody({ ingredient, onDone }: { ingredient: Ingredient; onDone: () => void }) {
  const { dispatch } = useKitchen();
  const toast = useToast();
  const [category, setCategory] = useState(ingredient.category);
  const [storage, setStorage] = useState<StorageLocation>(ingredient.defaultStorage);
  const [days, setDays] = useState<Record<StorageLocation, string>>({
    fridge: toText(ingredient.storageDays.fridge),
    freezer: toText(ingredient.storageDays.freezer),
    pantry: toText(ingredient.storageDays.pantry),
  });
  const defaultBasis: Nutrition["basis"] = ingredient.baseUnit === "ml" ? "per_100ml" : ingredient.baseUnit === "ea" ? "per_ea" : "per_100g";
  const [basis, setBasis] = useState<Nutrition["basis"]>(ingredient.nutrition?.basis ?? defaultBasis);
  const [nut, setNut] = useState<Record<NutKey, string>>({
    kcal: toText(ingredient.nutrition?.kcal),
    protein: toText(ingredient.nutrition?.protein),
    fat: toText(ingredient.nutrition?.fat),
    carbs: toText(ingredient.nutrition?.carbs),
  });
  const [gramsPerEa, setGramsPerEa] = useState(toText(ingredient.gramsPerEa));

  const filled = NUT_FIELDS.filter((f) => nut[f.key].trim() !== "").length;
  // 영양 정보는 4개 값을 모두 입력했을 때만 저장한다 (일부 값을 0으로 채우지 않음)
  const nutritionValid = filled === 0 || filled === NUT_FIELDS.length;

  const basisOptions: { value: Nutrition["basis"]; label: string }[] =
    ingredient.baseUnit === "ml"
      ? [{ value: "per_100ml", label: "100ml당" }]
      : ingredient.baseUnit === "g"
        ? [{ value: "per_100g", label: "100g당" }]
        : [
            { value: "per_ea", label: `1${unitLabel(ingredient)}당` },
            { value: "per_100g", label: "100g당" },
          ];

  const save = () => {
    const storageDays: Ingredient["storageDays"] = {};
    for (const l of STORAGE_ORDER) {
      const n = Number(days[l]);
      if (days[l].trim() !== "" && Number.isFinite(n) && n > 0) storageDays[l] = Math.round(n);
    }
    const nutrition: Nutrition | null =
      filled === NUT_FIELDS.length
        ? {
            basis,
            kcal: Number(nut.kcal) || 0,
            protein: Number(nut.protein) || 0,
            fat: Number(nut.fat) || 0,
            carbs: Number(nut.carbs) || 0,
          }
        : null;
    const gpe = Number(gramsPerEa);
    dispatch({
      type: "updateIngredient",
      id: ingredient.id,
      patch: {
        category,
        defaultStorage: storage,
        storageDays,
        nutrition,
        ...(ingredient.baseUnit === "ea" ? { gramsPerEa: gpe > 0 ? gpe : undefined } : {}),
      },
    });
    toast("식재료 정보를 저장했어요");
    onDone();
  };

  const numInput = "h-11 w-full min-w-0 rounded-xl border border-line px-3 text-right outline-none focus:border-green";

  return (
    <div className="space-y-6 pt-2">
      <section>
        <p className="mb-2 text-[13px] text-sub">분류</p>
        <CategoryPicker value={category} onChange={setCategory} />
      </section>

      <section>
        <p className="mb-2 text-[13px] text-sub">기본 보관 위치</p>
        <SegmentedControl
          label="기본 보관 위치"
          options={STORAGE_ORDER.map((l) => ({ value: l, label: STORAGE_LABEL[l] }))}
          value={storage}
          onChange={setStorage}
        />
      </section>

      <section>
        <p className="text-[13px] text-sub">보관 권장 기간 (일)</p>
        <p className="mb-2 text-[12px] text-mute">소비기한이 아닌 참고용 기간이에요. 모르면 비워 두세요.</p>
        <div className="grid grid-cols-3 gap-2">
          {STORAGE_ORDER.map((l) => (
            <label key={l} className="block min-w-0">
              <span className="mb-1 block text-[12.5px] text-sub">{STORAGE_LABEL[l]}</span>
              <input
                inputMode="numeric"
                value={days[l]}
                onChange={(e) => setDays((d) => ({ ...d, [l]: e.target.value.replace(/[^0-9]/g, "") }))}
                placeholder="-"
                className={numInput}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] text-sub">영양 정보</p>
          {basisOptions.length > 1 ? (
            <SegmentedControl className="w-44" label="기준" options={basisOptions} value={basis} onChange={setBasis} />
          ) : (
            <span className="text-[13px] text-sub">{basisOptions[0].label}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {NUT_FIELDS.map((f) => (
            <label key={f.key} className="block min-w-0">
              <span className="mb-1 block text-[12.5px] text-sub">
                {f.label} ({f.unit})
              </span>
              <input
                inputMode="decimal"
                value={nut[f.key]}
                onChange={(e) => setNut((n) => ({ ...n, [f.key]: e.target.value.replace(/[^0-9.]/g, "") }))}
                placeholder="-"
                className={numInput}
              />
            </label>
          ))}
        </div>
        {ingredient.baseUnit === "ea" && (
          <label className="mt-2 block">
            <span className="mb-1 block text-[12.5px] text-sub">1{unitLabel(ingredient)} 중량 (g) · 100g 기준 영양 계산에 필요</span>
            <input
              inputMode="decimal"
              value={gramsPerEa}
              onChange={(e) => setGramsPerEa(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="-"
              className={numInput}
            />
          </label>
        )}
        <p className={nutritionValid ? "mt-2 text-[12px] text-mute" : "mt-2 text-[12px] text-danger"}>
          {nutritionValid
            ? "포장 라벨의 영양성분표를 그대로 옮겨 적어 주세요. 비워 두면 '정보 없음'으로 남아요."
            : "열량·탄수화물·단백질·지방 4개를 모두 입력하거나 모두 비워 주세요."}
        </p>
      </section>

      <Button variant="primary" size="lg" block disabled={!nutritionValid} onClick={save}>
        저장
      </Button>
    </div>
  );
}
