"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { QuantityField } from "@/components/ui/QuantityField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { formatQuantity, formatWon, STORAGE_LABEL, STORAGE_ORDER } from "@/lib/domain/units";
import type { Ingredient, InventoryLot, StorageLocation } from "@/lib/domain/types";
import { useKitchen } from "@/lib/store/kitchen-store";

export type LotAction = "consume" | "discard" | "move";

const TITLE: Record<LotAction, string> = { consume: "사용하기", discard: "폐기하기", move: "보관 위치 이동" };

/** 수동 사용 · 폐기 · 이동 (DB 단계: consume_lot / move_lot) */
export function LotActionSheet({
  lot,
  ingredient,
  action,
  onClose,
}: {
  lot: InventoryLot | null;
  ingredient: Ingredient;
  action: LotAction | null;
  onClose: () => void;
}) {
  const open = !!lot && !!action;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={action ? TITLE[action] : ""}
      description={lot ? `${ingredient.name} · ${STORAGE_LABEL[lot.storage]} · 남은 양 ${formatQuantity(lot.qtyRemaining, ingredient)}` : undefined}
    >
      {open && <LotActionBody key={`${lot.id}-${action}`} lot={lot} ingredient={ingredient} action={action} onDone={onClose} />}
    </Sheet>
  );
}

function LotActionBody({
  lot,
  ingredient,
  action,
  onDone,
}: {
  lot: InventoryLot;
  ingredient: Ingredient;
  action: LotAction;
  onDone: () => void;
}) {
  const { dispatch, today } = useKitchen();
  const toast = useToast();
  const [qty, setQty] = useState(action === "consume" ? Math.min(lot.qtyRemaining, ingredient.baseUnit === "ea" ? 1 : 100) : lot.qtyRemaining);
  const others = STORAGE_ORDER.filter((l) => l !== lot.storage);
  const [to, setTo] = useState<StorageLocation>(others[0]);
  const cost = lot.unitCost == null ? null : Math.round(qty * lot.unitCost);

  const confirm = () => {
    if (action === "move") {
      dispatch({ type: "moveLot", lotId: lot.id, quantity: qty, to });
      toast(`${STORAGE_LABEL[to]}(으)로 옮겼어요 · ${formatQuantity(qty, ingredient)}`);
    } else {
      dispatch({ type: "consumeLot", lotId: lot.id, quantity: qty, reason: action === "discard" ? "discard" : "manual", on: today });
      toast(action === "discard" ? `${formatQuantity(qty, ingredient)} 폐기로 기록했어요` : `${formatQuantity(qty, ingredient)} 사용했어요`);
    }
    onDone();
  };

  return (
    <div className="space-y-4 pt-1">
      <QuantityField label={action === "move" ? "옮길 양" : action === "discard" ? "버릴 양" : "사용한 양"} ingredient={ingredient} value={qty} max={lot.qtyRemaining} onChange={setQty} />
      <div className="flex gap-2">
        {[0.25, 0.5, 1].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setQty(Number((lot.qtyRemaining * r).toFixed(ingredient.baseUnit === "ea" ? 1 : 0)))}
            className="h-9 flex-1 rounded-[10px] border border-line text-[13.5px] font-medium active:bg-subtle"
          >
            {r === 1 ? "전부" : r === 0.5 ? "절반" : "1/4"}
          </button>
        ))}
      </div>

      {action === "move" ? (
        <>
          <SegmentedControl label="이동할 위치" options={others.map((l) => ({ value: l, label: STORAGE_LABEL[l] }))} value={to} onChange={setTo} />
          <p className="text-[12.5px] leading-relaxed text-sub">
            일부만 옮기면 같은 구매 건에서 나뉜 재고로 따로 관리돼요. 확인된 소비기한은 그대로 유지되고, 보관 권장 기한만 새 위치 기준으로 바뀌어요.
          </p>
        </>
      ) : (
        cost != null && (
          <div className="flex items-baseline justify-between rounded-xl bg-subtle px-4 py-3">
            <span className="text-[14px] text-sub">{action === "discard" ? "폐기 금액" : "사용 원가"}</span>
            <b className={action === "discard" ? "text-[18px] font-bold text-danger" : "text-[18px] font-bold"}>{formatWon(cost)}</b>
          </div>
        )
      )}

      <Button variant={action === "discard" ? "danger" : "primary"} size="lg" block disabled={qty <= 0} onClick={confirm}>
        {action === "move" ? `${STORAGE_LABEL[to]}에 보관` : action === "discard" ? "폐기로 기록" : "사용으로 기록"}
      </Button>
    </div>
  );
}
