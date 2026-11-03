"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { quantityStep, unitLabel } from "@/lib/domain/units";
import type { Ingredient } from "@/lib/domain/types";

/** 기준 단위(g/ml/개) 수량 입력 — 스테퍼 + 직접 입력 */
export function QuantityField({
  ingredient,
  value,
  onChange,
  max,
  label,
}: {
  ingredient: Pick<Ingredient, "baseUnit" | "eaLabel">;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  label?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const step = quantityStep(ingredient.baseUnit);
  const clamp = (v: number) => {
    const n = Math.max(0, Number.isFinite(v) ? v : 0);
    return max != null ? Math.min(n, max) : n;
  };
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] text-sub">
          {label}
        </label>
      )}
      <div className="flex h-12 items-center rounded-xl border border-line">
        <button
          type="button"
          aria-label="줄이기"
          onClick={() => onChange(clamp(Number((value - step).toFixed(3))))}
          className="flex h-full w-12 items-center justify-center text-sub active:bg-subtle disabled:text-line-strong"
          disabled={value <= 0}
        >
          <Minus size={18} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1">
          <input
            id={id}
            inputMode="decimal"
            value={draft ?? (Number.isFinite(value) ? String(value) : "")}
            onFocus={(e) => {
              setDraft(e.target.value);
              e.target.select();
            }}
            onChange={(e) => {
              const text = e.target.value.replace(/[^0-9.]/g, "");
              setDraft(text);
              const v = Number(text);
              if (text !== "" && !text.endsWith(".") && Number.isFinite(v)) onChange(clamp(v));
            }}
            onBlur={() => {
              if (draft != null) onChange(clamp(Number(draft) || 0));
              setDraft(null);
            }}
            className="w-20 bg-transparent text-center text-[17px] font-semibold outline-none"
          />
          <span className="text-[14px] text-sub">{unitLabel(ingredient)}</span>
        </div>
        <button
          type="button"
          aria-label="늘리기"
          onClick={() => onChange(clamp(Number((value + step).toFixed(3))))}
          className="flex h-full w-12 items-center justify-center text-sub active:bg-subtle disabled:text-line-strong"
          disabled={max != null && value >= max}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
