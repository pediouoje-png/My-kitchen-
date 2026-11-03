import type { InventoryLot } from "./types";

/**
 * 재고 차감 순서: 확인된 소비기한 빠른 순 → 권장기한 빠른 순 → 입고일 순 (FIFO)
 * DB 단계에서는 complete_meal() 함수가 같은 규칙으로 로트를 잠그고 차감한다.
 */
export function fifoOrder(a: InventoryLot, b: InventoryLot): number {
  const ka = a.expiryDate ?? "9999-12-31";
  const kb = b.expiryDate ?? "9999-12-31";
  if (ka !== kb) return ka < kb ? -1 : 1;
  const ra = a.recommendedUseBy ?? "9999-12-31";
  const rb = b.recommendedUseBy ?? "9999-12-31";
  if (ra !== rb) return ra < rb ? -1 : 1;
  return a.acquiredOn < b.acquiredOn ? -1 : a.acquiredOn > b.acquiredOn ? 1 : 0;
}

export interface Allocation {
  lotId: string;
  quantity: number;
  unitCost: number | null;
  cost: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  shortage: number;
  /** 가격을 아는 배분분의 원가 합 */
  cost: number;
  /** 가격 정보 없는 로트에서 배분된 수량이 있는지 */
  hasUnpricedLots: boolean;
}

const EPS = 1e-6;

/** 필요량을 로트들에 FIFO로 배분한다 (순수 함수, 상태 변경 없음). */
export function allocateFIFO(lots: InventoryLot[], ingredientId: string, quantity: number): AllocationResult {
  const candidates = lots
    .filter((l) => l.ingredientId === ingredientId && l.status === "active" && l.qtyRemaining > EPS)
    .sort(fifoOrder);
  let remaining = quantity;
  const allocations: Allocation[] = [];
  let hasUnpricedLots = false;
  for (const lot of candidates) {
    if (remaining <= EPS) break;
    const take = Math.min(remaining, lot.qtyRemaining);
    const cost = lot.unitCost == null ? 0 : Math.round(take * lot.unitCost);
    if (lot.unitCost == null) hasUnpricedLots = true;
    allocations.push({ lotId: lot.id, quantity: take, unitCost: lot.unitCost, cost });
    remaining -= take;
  }
  return {
    allocations,
    shortage: remaining > EPS ? remaining : 0,
    cost: allocations.reduce((s, a) => s + a.cost, 0),
    hasUnpricedLots,
  };
}

/** 최근 구매 단가 (재고 부족분 추정용) */
export function lastKnownUnitCost(lots: InventoryLot[], ingredientId: string): number | null {
  const priced = lots
    .filter((l) => l.ingredientId === ingredientId && l.unitCost != null)
    .sort((a, b) => (a.acquiredOn < b.acquiredOn ? 1 : -1));
  return priced[0]?.unitCost ?? null;
}

export interface CostEstimate {
  /** 원 */
  total: number;
  /** 재고 부족분을 최근 구매가로 추정한 부분이 있는지 */
  estimated: boolean;
  /** 가격을 전혀 알 수 없는 재료 수 */
  unknownCount: number;
}

/**
 * 재료 목록의 예상 원가.
 * 보유분은 실제 로트 단가(FIFO), 부족분은 최근 구매가로 추정, 둘 다 없으면 제외.
 */
export function estimateCost(
  lots: InventoryLot[],
  needs: { ingredientId: string | null; quantity: number | null }[],
): CostEstimate {
  let total = 0;
  let estimated = false;
  let unknownCount = 0;
  for (const need of needs) {
    if (!need.ingredientId) {
      if (need.quantity != null) unknownCount += 1;
      continue;
    }
    // "약간/적당량"은 원가 계산에서 제외
    if (need.quantity == null) continue;
    const r = allocateFIFO(lots, need.ingredientId, need.quantity);
    total += r.cost;
    if (r.hasUnpricedLots) unknownCount += 1;
    if (r.shortage > 0) {
      const last = lastKnownUnitCost(lots, need.ingredientId);
      if (last != null) {
        total += Math.round(r.shortage * last);
        estimated = true;
      } else {
        unknownCount += 1;
      }
    }
  }
  return { total, estimated, unknownCount };
}
