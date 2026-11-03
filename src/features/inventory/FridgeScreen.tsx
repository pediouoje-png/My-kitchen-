"use client";

import { ChevronDown, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { ExpiryBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatMD } from "@/lib/date";
import { summarizeStock, type StockSummary } from "@/lib/domain/stock";
import { formatQuantity, formatUnitPrice, STORAGE_LABEL, STORAGE_ORDER } from "@/lib/domain/units";
import type { StorageLocation } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";
import { AddLotSheet } from "./AddLotSheet";

type Loc = StorageLocation | "all";
type Sort = "expiry" | "category" | "recent";

const SORT_LABEL: Record<Sort, string> = { expiry: "소비기한 임박순", category: "카테고리순", recent: "최근 구매순" };

function isLoc(v: string | null): v is Loc {
  return v === "all" || v === "fridge" || v === "freezer" || v === "pantry";
}

export function FridgeScreen() {
  const { state, today } = useKitchen();
  const router = useRouter();
  const params = useSearchParams();
  const locParam = params.get("location");
  const loc: Loc = isLoc(locParam) ? locParam : "fridge";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("expiry");
  const [adding, setAdding] = useState(false);
  const soonDays = state.settings.soonDays;

  const counts = useMemo(() => {
    const c: Record<Loc, number> = { fridge: 0, freezer: 0, pantry: 0, all: 0 };
    for (const l of STORAGE_ORDER) c[l] = summarizeStock(state.ingredients, state.lots, today, soonDays, l).length;
    c.all = summarizeStock(state.ingredients, state.lots, today, soonDays).length;
    return c;
  }, [state.ingredients, state.lots, today, soonDays]);

  const rows = useMemo(() => {
    const q = query.trim();
    const list = summarizeStock(state.ingredients, state.lots, today, soonDays, loc === "all" ? undefined : loc).filter(
      (s) => !q || s.ingredient.name.includes(q) || s.ingredient.category.includes(q),
    );
    if (sort === "expiry") list.sort((a, b) => a.expiry.sortKey - b.expiry.sortKey || a.ingredient.name.localeCompare(b.ingredient.name, "ko"));
    if (sort === "recent") list.sort((a, b) => (a.lastAcquired < b.lastAcquired ? 1 : a.lastAcquired > b.lastAcquired ? -1 : 0));
    if (sort === "category")
      list.sort((a, b) => a.ingredient.category.localeCompare(b.ingredient.category, "ko") || a.ingredient.name.localeCompare(b.ingredient.name, "ko"));
    return list;
  }, [state.ingredients, state.lots, today, soonDays, loc, query, sort]);

  return (
    <>
      <PageHeader
        title="냉장고"
        right={
          <button
            type="button"
            aria-label="재료 직접 등록"
            onClick={() => setAdding(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full active:bg-subtle"
          >
            <Plus size={24} strokeWidth={1.75} />
          </button>
        }
      />

      <div className="px-5">
        <div className="flex h-11 items-center gap-2 rounded-xl bg-subtle px-3.5 text-mute">
          <Search size={18} className="shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="식재료 검색"
            aria-label="식재료 검색"
            className="h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-mute [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")} className="text-mute">
              <X size={17} />
            </button>
          )}
        </div>

        <SegmentedControl
          className="mt-3"
          label="보관 위치"
          value={loc}
          onChange={(v) => router.replace(`/fridge?location=${v}`, { scroll: false })}
          options={[
            ...STORAGE_ORDER.map((l) => ({ value: l as Loc, label: STORAGE_LABEL[l], count: counts[l] })),
            { value: "all" as Loc, label: "전체" },
          ]}
        />

        <div className="mt-4 mb-0.5 flex items-center justify-between text-[13px] text-sub">
          <span>
            {rows.length}개 재료{query && ` · ‘${query}’ 검색`}
          </span>
          <label className="relative inline-flex h-8 items-center gap-0.5">
            {SORT_LABEL[sort]}
            <ChevronDown size={14} />
            <select
              aria-label="정렬"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={query ? "찾는 재료가 없어요" : "비어 있어요"}
            description={query ? "다른 이름으로 검색해 보세요." : "영수증을 올리거나 직접 등록해 보세요."}
          />
        ) : (
          <ul>
            {rows.map((s, i) => (
              <Fragment key={s.ingredient.id}>
                {sort === "category" && (i === 0 || rows[i - 1].ingredient.category !== s.ingredient.category) && (
                  <li className="pt-4 pb-1 text-[13px] font-semibold text-sub">{s.ingredient.category}</li>
                )}
                <li>
                  <InventoryRow s={s} showLocation={loc === "all"} />
                </li>
              </Fragment>
            ))}
          </ul>
        )}
      </div>

      <AddLotSheet open={adding} onClose={() => setAdding(false)} defaultStorage={loc === "all" ? "fridge" : loc} />
    </>
  );
}

function InventoryRow({ s, showLocation }: { s: StockSummary; showLocation: boolean }) {
  const first = s.lots[0];
  const locs = [...new Set(s.lots.map((l) => STORAGE_LABEL[l.storage]))].join("·");
  const detail =
    s.lots.length > 1
      ? `${s.lots.length}건 · ${formatMD(s.lastAcquired)} 구매 외`
      : `${formatMD(first.acquiredOn)} ${first.sourceLabel ? "구매" : "등록"}`;
  const tail = s.expiry.kind !== "confirmed" ? "기한 정보 없음" : s.avgUnitCost != null ? formatUnitPrice(s.avgUnitCost, s.ingredient) : "가격 정보 없음";
  return (
    <Link href={`/fridge/${s.ingredient.id}`} className="flex items-center gap-3 border-b border-line py-3 active:bg-subtle">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-subtle text-[11.5px] font-semibold text-sub">
        {s.ingredient.category.slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[16px] font-semibold">{s.ingredient.name}</b>
        <span className="block truncate text-[13px] text-sub">
          {showLocation && `${locs} · `}
          {detail} · {tail}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[15px] font-medium">{formatQuantity(s.total, s.ingredient)}</span>
        <ExpiryBadge info={s.expiry} />
      </span>
    </Link>
  );
}
