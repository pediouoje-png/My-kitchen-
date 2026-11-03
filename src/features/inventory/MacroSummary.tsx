"use client";

import { cn } from "@/lib/cn";
import {
  MACRO_LABEL,
  MACRO_ORDER,
  RICH_THRESHOLD,
  stockComposition,
  type Macro,
} from "@/lib/domain/nutrition";
import type { StockSummary } from "@/lib/domain/stock";
import { MACRO_COLOR } from "./MacroTags";

function grams(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}kg` : `${Math.round(n).toLocaleString("ko-KR")}g`;
}

/**
 * 보유 재고의 탄·단·지 구성 (코드 계산, AI 미사용).
 * 영양소를 누르면 그 영양소가 풍부한 재료만 목록에 남긴다.
 */
export function MacroSummary({
  stock,
  scopeLabel,
  selected,
  onSelect,
}: {
  stock: StockSummary[];
  scopeLabel: string;
  selected: Macro | null;
  onSelect: (m: Macro | null) => void;
}) {
  const c = stockComposition(stock);
  const total = MACRO_ORDER.reduce((s, m) => s + c.share[m], 0);
  if (stock.length === 0) return null;

  const lead = total > 0 ? MACRO_ORDER.reduce((a, b) => (c.share[b] > c.share[a] ? b : a)) : null;
  const lowProtein = total > 0 && c.share.protein < 0.15;
  const referenceCount = stock.filter((s) => s.ingredient.nutrition?.source === "reference").length;

  return (
    <section aria-label="영양 구성" className="mt-4 rounded-[14px] border border-line p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">
          {lead ? (
            <>
              <span style={{ color: lead === "carbs" ? "#55735d" : lead === "fat" ? "#9a6447" : undefined }} className={lead === "protein" ? "text-green" : undefined}>
                {MACRO_LABEL[lead]}
              </span>
              이 가장 많아요
            </>
          ) : (
            "영양 구성"
          )}
        </h2>
        <span className="shrink-0 text-[12px] text-sub">{scopeLabel} 재고 · 열량 기준</span>
      </div>
      {lowProtein && <p className="mt-0.5 text-[12.5px] text-sub">단백질 재료가 적은 편이에요</p>}

      {total > 0 && (
        <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {MACRO_ORDER.map((m) =>
            c.share[m] > 0 ? <span key={m} style={{ width: `${c.share[m] * 100}%`, background: MACRO_COLOR[m] }} /> : null,
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {MACRO_ORDER.map((m) => {
          const on = selected === m;
          const top = c.top[m];
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : m)}
              className={cn(
                "min-w-0 rounded-xl border px-2.5 py-2 text-left transition-colors",
                on ? "border-ink bg-subtle" : "border-transparent bg-subtle active:border-line-strong",
              )}
            >
              <span className="flex items-center gap-1 text-[12px] text-sub">
                <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: MACRO_COLOR[m] }} />
                {MACRO_LABEL[m]}
              </span>
              <b className="mt-0.5 block text-[17px] font-bold">{Math.round(c.share[m] * 100)}%</b>
              <span className="block text-[11.5px] text-sub">{grams(c.grams[m])}</span>
              <span className="mt-1 block truncate text-[12px] text-ink">
                {top.length > 0 ? top.slice(0, 2).map((t) => t.ingredient.name).join(", ") : <span className="text-mute">풍부한 재료 없음</span>}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-mute">
        ‘풍부’ 기준: 100g당 탄수화물 {RICH_THRESHOLD.carbs}g · 단백질 {RICH_THRESHOLD.protein}g · 지방 {RICH_THRESHOLD.fat}g 이상
        {referenceCount > 0 && ` · ${referenceCount}개 재료는 일반 참고값 기준`}
        {c.missing.length > 0 && ` · 영양 정보 없는 ${c.missing.map((i) => i.name).join(", ")} 제외`}
      </p>
    </section>
  );
}
