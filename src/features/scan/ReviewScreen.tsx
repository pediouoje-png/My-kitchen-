"use client";

import { AlertCircle, Check, ChevronRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { DetailHeader } from "@/components/ui/PageHeader";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatQuantity, formatUnitPrice, formatWon, STORAGE_LABEL } from "@/lib/domain/units";
import type { AnalysisDraft, DraftItem } from "@/lib/domain/types";
import { blankItem, blockingIssues, checkTotals, itemFinalPrice, itemIssues, itemUnitCost, reallocate } from "@/lib/receipt/draft";
import { useKitchen } from "@/lib/store/kitchen-store";
import { getSessionPreviews } from "./analyze";
import { ReviewItemSheet } from "./ReviewItemSheet";

const noop = () => () => {};

/** 분석 결과 검수 — 사용자가 승인해야만 구매 내역과 재고에 반영된다 */
export function ReviewScreen() {
  const { state, dispatch } = useKitchen();
  const router = useRouter();
  const toast = useToast();
  const draft = state.pendingAnalysis ?? null;
  const [editing, setEditing] = useState<DraftItem | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  // 원본 사진은 이번 세션 메모리에만 있다 (새로고침 후에는 없음)
  const previews = useSyncExternalStore(noop, getSessionPreviews, () => []);

  const update = (next: AnalysisDraft) => dispatch({ type: "setAnalysisDraft", draft: reallocate(next) });

  const summary = useMemo(() => {
    if (!draft) return null;
    const included = draft.items.filter((i) => i.include);
    return {
      totals: checkTotals(draft),
      food: included.filter((i) => i.isFood),
      nonFood: included.filter((i) => !i.isFood).length,
      excluded: draft.items.length - included.length,
      needCheck: draft.items.filter((i) => itemIssues(i).length > 0).length,
      blocking: draft.items.filter((i) => blockingIssues(i).length > 0).length,
    };
  }, [draft]);

  if (!draft || !summary) {
    return (
      <>
        <DetailHeader title="분석 결과 검수" fallbackHref="/scan" />
        <EmptyState
          title="검수할 분석 결과가 없어요"
          description="영수증이나 주문내역 사진을 올려 분석해 보세요."
          action={
            <Link href="/scan" className="font-semibold text-green">
              사진 올리러 가기
            </Link>
          }
        />
      </>
    );
  }

  const { totals } = summary;
  const isSample = draft.model == null && draft.notes?.startsWith("예시 데이터");

  const saveItem = (item: DraftItem) => {
    const exists = draft.items.some((i) => i.id === item.id);
    update({ ...draft, items: exists ? draft.items.map((i) => (i.id === item.id ? item : i)) : [...draft.items, item] });
    setEditing(null);
  };

  const approve = () => {
    const count = summary.food.length;
    setEditing(null);
    setViewer(null);
    dispatch({ type: "approvePurchase", draft });
    toast(count > 0 ? `재고 ${count}개를 등록했어요` : "구매 내역을 저장했어요", { label: "냉장고 보기", href: "/fridge?location=all" });
    router.replace("/scan");
  };

  const numInput = (v: string) => Math.max(0, Math.round(Number(v.replace(/[^0-9]/g, "")) || 0));

  return (
    <div className="pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <DetailHeader title="분석 결과 검수" fallbackHref="/scan" />

      <div className="px-5 pt-1">
        {isSample && (
          <p className="mb-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] text-[#8a6220]">
            예시 데이터예요. 승인하면 실제 재고에 등록되니, 체험 후에는 설정에서 초기화할 수 있어요.
          </p>
        )}

        {previews.length > 0 && (
          <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
            {previews.map((u, i) => (
              <button
                key={u}
                type="button"
                onClick={() => setViewer(u)}
                aria-label={`원본 이미지 ${i + 1} 크게 보기`}
                className="h-[72px] w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-subtle"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            <span className="flex shrink-0 flex-col justify-center pl-1 text-[12.5px] leading-relaxed text-sub">
              원본 {previews.length}장
              <br />
              눌러서 비교
            </span>
          </div>
        )}

        <section className="rounded-[14px] border border-line px-4 py-1">
          <Row label="구매처">
            <input
              value={draft.storeName}
              onChange={(e) => update({ ...draft, storeName: e.target.value })}
              placeholder="예: 동네 마트"
              aria-label="구매처"
              className="w-full bg-transparent text-right font-semibold outline-none placeholder:font-normal placeholder:text-mute"
            />
          </Row>
          <Row label="구매일">
            <input
              type="date"
              value={draft.purchasedOn}
              onChange={(e) => e.target.value && update({ ...draft, purchasedOn: e.target.value })}
              aria-label="구매일"
              className="w-full appearance-none bg-transparent text-right font-semibold outline-none [&::-webkit-date-and-time-value]:text-right"
            />
          </Row>
          <Row label="주문 할인·쿠폰">
            <MoneyInput value={draft.discountTotal} onChange={(v) => update({ ...draft, discountTotal: v ?? 0 })} parse={numInput} label="주문 할인" />
          </Row>
          <Row label="배송비">
            <MoneyInput value={draft.deliveryFee} onChange={(v) => update({ ...draft, deliveryFee: v ?? 0 })} parse={numInput} label="배송비" />
          </Row>
          <Row label="결제 금액" last>
            <MoneyInput
              value={draft.totalPaid}
              onChange={(v) => update({ ...draft, totalPaid: v })}
              parse={numInput}
              label="결제 금액"
              placeholder="모름"
            />
          </Row>
        </section>

        <TotalBadge diff={totals.diff} discount={draft.discountTotal} />
        {draft.notes && !isSample && (
          <p className="mt-2 flex gap-1.5 text-[12.5px] leading-relaxed text-sub">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {draft.notes}
          </p>
        )}

        <div className="mt-5 mb-2 flex items-baseline justify-between text-[13px] text-sub">
          <span>
            {draft.items.length}개 품목{summary.needCheck > 0 && <b className="font-semibold text-warn"> · 확인 필요 {summary.needCheck}</b>}
          </span>
          <span>
            {summary.nonFood > 0 && `식품 아님 ${summary.nonFood}`}
            {summary.excluded > 0 && ` · 제외 ${summary.excluded}`}
          </span>
        </div>

        <div className="space-y-2.5">
          {draft.items.map((item) => (
            <ItemCard key={item.id} item={item} onOpen={() => setEditing(item)} />
          ))}
          <button
            type="button"
            onClick={() => setEditing(blankItem())}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-line-strong text-[14px] font-medium text-sub active:bg-subtle"
          >
            <Plus size={17} /> 빠진 품목 추가
          </button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-bg px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {summary.blocking > 0 && (
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-warn">
            <AlertCircle size={14} /> 확인이 필요한 품목 {summary.blocking}개를 먼저 처리해 주세요
          </p>
        )}
        <div className="grid grid-cols-[96px_1fr] gap-2">
          <Button size="lg" onClick={() => setConfirmCancel(true)}>
            취소
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={summary.blocking > 0 || draft.items.filter((i) => i.include).length === 0}
            onClick={approve}
          >
            승인하고 재고 등록 · {summary.food.length}
          </Button>
        </div>
      </div>

      <ReviewItemSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSave={saveItem}
        onDelete={(id) => {
          update({ ...draft, items: draft.items.filter((i) => i.id !== id) });
          setEditing(null);
        }}
      />

      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="검수를 취소할까요?"
        description="분석 결과를 버리고, 재고에는 아무것도 등록하지 않아요."
      >
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button size="lg" onClick={() => setConfirmCancel(false)}>
            계속 검수
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              // Next.js 16은 떠난 화면의 상태를 기억하므로, 시트를 닫고 나서 이동한다
              setConfirmCancel(false);
              dispatch({ type: "setAnalysisDraft", draft: null });
              router.replace("/scan");
            }}
          >
            버리기
          </Button>
        </div>
      </Sheet>

      {viewer && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-ink" role="dialog" aria-label="원본 이미지">
          <div className="flex justify-end p-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setViewer(null)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white active:bg-white/10"
            >
              <X size={24} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewer} alt="원본 이미지" className="mx-auto w-full max-w-[480px]" />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <label className={cn("flex h-12 items-center gap-3 text-[14.5px]", !last && "border-b border-line")}>
      <span className="shrink-0 text-sub">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}

function MoneyInput({
  value,
  onChange,
  parse,
  label,
  placeholder = "0",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  parse: (v: string) => number;
  label: string;
  placeholder?: string;
}) {
  return (
    <span className="flex items-center justify-end gap-0.5">
      <input
        inputMode="numeric"
        aria-label={label}
        value={value == null || value === 0 ? "" : value.toLocaleString("ko-KR")}
        onChange={(e) => onChange(e.target.value.trim() === "" ? (placeholder === "모름" ? null : 0) : parse(e.target.value))}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-right font-semibold outline-none placeholder:font-normal placeholder:text-mute"
      />
      <span className="text-sub">원</span>
    </span>
  );
}

function TotalBadge({ diff, discount }: { diff: number | null; discount: number }) {
  if (diff == null) {
    return <p className="mt-2.5 rounded-xl bg-subtle px-3.5 py-2.5 text-[13px] text-sub">결제 금액을 입력하면 품목 합계와 맞는지 확인해요.</p>;
  }
  if (diff === 0) {
    return (
      <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-green-soft px-3.5 py-2.5 text-[13.5px] font-medium text-green-ink">
        <Check size={17} className="shrink-0 text-green" />
        품목 합계와 결제 금액이 일치해요{discount > 0 && ` (할인 ${formatWon(discount)} 배분)`}
      </p>
    );
  }
  return (
    <p className="mt-2.5 flex gap-2 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-[#8a6220]">
      <AlertCircle size={17} className="mt-px shrink-0" />
      <span>
        결제 금액과 {formatWon(Math.abs(diff))} 차이가 나요. 빠진 품목이나 할인, 배송비를 확인해 주세요.
      </span>
    </p>
  );
}

function ItemCard({ item, onOpen }: { item: DraftItem; onOpen: () => void }) {
  const { state } = useKitchen();
  const linked = item.ingredientId ? state.ingredients.find((i) => i.id === item.ingredientId) : undefined;
  const unitRef = linked ?? { baseUnit: item.newUnit };
  const issues = itemIssues(item);
  const blocking = blockingIssues(item);
  const unitCost = itemUnitCost(item);

  if (!item.include || !item.isFood) {
    return (
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-[14px] border border-line px-4 py-3 text-left opacity-70 active:bg-subtle">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px]">{item.rawName || "이름 없음"}</span>
          <span className="text-[12.5px] text-sub">{item.include ? `식품 아님 · 재고에 넣지 않아요 · ${formatWon(itemFinalPrice(item))}` : "제외됨"}</span>
        </span>
        <ChevronRight size={18} className="text-mute" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "block w-full rounded-[14px] border px-4 py-3.5 text-left active:bg-subtle",
        blocking.length > 0 ? "border-[#e3c9a0]" : "border-line",
      )}
    >
      <p className="truncate text-[12.5px] text-sub">{item.rawName || "직접 추가한 품목"}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <b className="truncate text-[16px] font-semibold">{linked?.name ?? (item.newName || "식재료 선택")}</b>
          {linked ? (
            <Badge tone="green">{item.matchedBy === "user" ? "연결됨" : "자동 매칭"}</Badge>
          ) : item.newName ? (
            <Badge tone="gray">새 식재료</Badge>
          ) : (
            <Badge tone="warn">연결 필요</Badge>
          )}
          {item.confidence === "low" && <Badge tone="warn">흐림</Badge>}
        </span>
        <ChevronRight size={18} className="shrink-0 text-mute" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13.5px]">
        <div>
          <span className="block text-[12px] text-sub">수량</span>
          {item.quantity ? (
            <span className="font-medium">
              {formatQuantity(item.quantity, unitRef)} <small className="font-normal text-sub">({item.quantityText})</small>
            </span>
          ) : (
            <span className="font-semibold text-warn">확인 필요 ({item.quantityText})</span>
          )}
        </div>
        <div>
          <span className="block text-[12px] text-sub">금액 (할인 후)</span>
          <span className="font-medium">{formatWon(itemFinalPrice(item))}</span>
        </div>
        <div>
          <span className="block text-[12px] text-sub">단위 가격</span>
          <span className="font-medium">{unitCost == null ? "-" : formatUnitPrice(unitCost, unitRef)}</span>
        </div>
        <div>
          <span className="block text-[12px] text-sub">보관</span>
          <span className="font-medium">{STORAGE_LABEL[item.storage]}</span>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5 text-[13px]">
        <span className="text-sub">소비기한</span>
        {item.expiryDate ? (
          <span className="flex items-center gap-1.5">
            {item.expiryDate.slice(5).replace("-", ". ")}
            {item.expiryFromImage && <Badge tone="warn">이미지에서 읽음 · 확인</Badge>}
          </span>
        ) : (
          <span className="text-sub">없음 · 직접 입력 가능</span>
        )}
      </div>
      {issues.length > 0 && blocking.length > 0 && (
        <p className="mt-2 text-[12.5px] font-medium text-warn">{blocking.join(" · ")}</p>
      )}
    </button>
  );
}
