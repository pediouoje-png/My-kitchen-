"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { guessCategory } from "@/lib/domain/category";
import { findReferenceNutrition } from "@/lib/domain/reference-nutrition";
import { formatQuantity, STORAGE_LABEL, STORAGE_ORDER, unitLabel } from "@/lib/domain/units";
import type { Ingredient, Nutrition, StorageLocation } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { ingredientUsage } from "@/lib/store/reducer";
import { CategoryPicker } from "./CategoryPicker";

/** 식재료 기본 정보 수정: 이름 · 분류 · 기본 보관 위치 · 보관 권장 기간 · 영양 정보 · 삭제 */
export function EditIngredientSheet({
  ingredient,
  open,
  onClose,
  onDeleted,
}: {
  ingredient: Ingredient;
  open: boolean;
  onClose: () => void;
  /** 삭제 후 호출 — 상세 화면을 떠나야 한다 */
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    setConfirming(false);
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title={confirming ? "이 식재료를 삭제할까요?" : "식재료 정보 수정"}
      description={ingredient.name}
    >
      {open &&
        (confirming ? (
          <DeleteConfirm
            ingredient={ingredient}
            onCancel={() => setConfirming(false)}
            onDeleted={() => {
              setConfirming(false);
              onDeleted();
            }}
          />
        ) : (
          <EditBody ingredient={ingredient} onDone={close} onDelete={() => setConfirming(true)} />
        ))}
    </Sheet>
  );
}

function DeleteConfirm({ ingredient, onCancel, onDeleted }: { ingredient: Ingredient; onCancel: () => void; onDeleted: () => void }) {
  const { state, dispatch } = useKitchen();
  const toast = useToast();
  const usage = ingredientUsage(state, ingredient.id);
  const effects = [
    usage.activeLots > 0 && `남은 재고 ${usage.activeLots}건(${formatQuantity(usage.stock, ingredient)})이 함께 삭제돼요.`,
    usage.plannedMeals > 0 && `아직 먹지 않은 식단 ${usage.plannedMeals}개에서 이 재료가 빠져요.`,
    usage.recipes > 0 && `레시피 ${usage.recipes}개에는 재료 이름만 남아요.`,
    usage.logs > 0 && "지난 사용 기록과 식비·폐기 금액은 그대로 남아요.",
  ].filter((x): x is string => !!x);

  const remove = () => {
    const before = state; // 되돌리기용 (삭제 직전 상태 그대로)
    dispatch({ type: "deleteIngredient", id: ingredient.id });
    toast(`‘${ingredient.name}’을 삭제했어요`, {
      label: "되돌리기",
      onClick: () => dispatch({ type: "replace", state: before }),
    });
    onDeleted();
  };

  return (
    <div className="space-y-4 pt-2">
      {effects.length > 0 ? (
        <ul className="space-y-1.5 rounded-xl bg-subtle px-4 py-3 text-[14px] leading-relaxed">
          {effects.map((e) => (
            <li key={e}>· {e}</li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-subtle px-4 py-3 text-[14px] text-sub">재고나 식단에 쓰인 곳이 없어 바로 지워져요.</p>
      )}
      <p className="text-[13px] text-sub">이름만 잘못 썼다면 삭제 대신 이름을 고칠 수 있어요.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={onCancel}>
          취소
        </Button>
        <Button variant="danger" size="lg" onClick={remove}>
          삭제
        </Button>
      </div>
    </div>
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

function EditBody({ ingredient, onDone, onDelete }: { ingredient: Ingredient; onDone: () => void; onDelete: () => void }) {
  const { state, dispatch } = useKitchen();
  const toast = useToast();
  const [name, setName] = useState(ingredient.name);
  const trimmed = name.trim();
  const duplicate = state.ingredients.some((i) => i.id !== ingredient.id && i.name === trimmed);
  const nameError = !trimmed ? "이름을 입력해 주세요." : duplicate ? `‘${trimmed}’은 이미 있는 식재료예요.` : null;
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
  // 참고값을 그대로 쓰는지 (값을 하나라도 고치면 직접 입력으로 바뀐다)
  const [fromReference, setFromReference] = useState(ingredient.nutrition?.source === "reference");
  const ref = findReferenceNutrition(ingredient.name, ingredient.baseUnit);

  const loadReference = () => {
    if (!ref) return;
    setBasis(ref.nutrition.basis);
    setNut({
      kcal: String(ref.nutrition.kcal),
      protein: String(ref.nutrition.protein),
      fat: String(ref.nutrition.fat),
      carbs: String(ref.nutrition.carbs),
    });
    if (ref.gramsPerEa && !gramsPerEa) setGramsPerEa(String(ref.gramsPerEa));
    setFromReference(true);
  };

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
            source: fromReference ? "reference" : "user",
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
        name: trimmed,
        // 예전 이름은 별칭으로 남겨 영수증 자동 매칭에 계속 쓴다
        ...(trimmed !== ingredient.name
          ? { aliases: [...new Set([...(ingredient.aliases ?? []), ingredient.name])] }
          : {}),
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
        <label className="block">
          <span className="mb-2 block text-[13px] text-sub">이름</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              // 분류가 아직 '기타'면 고친 이름으로 분류를 추천한다
              const guess = guessCategory(e.target.value);
              if (category === "기타" && guess) setCategory(guess);
            }}
            aria-label="식재료 이름"
            className="h-12 w-full rounded-xl border border-line px-4 outline-none focus:border-green"
          />
        </label>
        {nameError && trimmed !== ingredient.name && <p className="mt-1.5 text-[12.5px] text-danger">{nameError}</p>}
      </section>

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
                onChange={(e) => {
                  setNut((n) => ({ ...n, [f.key]: e.target.value.replace(/[^0-9.]/g, "") }));
                  setFromReference(false);
                }}
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
        {ref && (
          <button
            type="button"
            onClick={loadReference}
            className="mt-2 h-9 rounded-full border border-line px-3.5 text-[13px] font-medium active:bg-subtle"
          >
            ‘{ref.matchedName}’ 참고값 불러오기
          </button>
        )}
        <p className={nutritionValid ? "mt-2 text-[12px] text-mute" : "mt-2 text-[12px] text-danger"}>
          {nutritionValid
            ? "포장 라벨의 영양성분표를 그대로 옮겨 적어 주세요. 비워 두면 '정보 없음'으로 남아요."
            : "열량·탄수화물·단백질·지방 4개를 모두 입력하거나 모두 비워 주세요."}
        </p>
      </section>

      <div className="space-y-2">
        <Button variant="primary" size="lg" block disabled={!nutritionValid || !!nameError} onClick={save}>
          저장
        </Button>
        <Button variant="danger" size="lg" block onClick={onDelete}>
          식재료 삭제
        </Button>
      </div>
    </div>
  );
}
