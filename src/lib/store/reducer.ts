import { addDays } from "@/lib/date";
import { allocateFIFO } from "@/lib/domain/costing";
import type {
  ConsumptionLog,
  Ingredient,
  InventoryLot,
  ISODate,
  KitchenSettings,
  KitchenState,
  MealPlan,
  MealPlanItem,
  MealType,
  StorageLocation,
} from "@/lib/domain/types";

/**
 * 클라이언트 목업 저장소의 상태 전이.
 * 각 액션은 이후 Supabase RPC(complete_meal, consume_lot, move_lot …)로 대체된다.
 * 규칙은 DB 함수와 동일하게 유지한다: 재고 변경은 항상 소비 로그와 함께 일어난다.
 */

export type KitchenAction =
  | { type: "replace"; state: KitchenState }
  | {
      type: "completeMeal";
      mealId: string;
      on: ISODate;
      /** ingredientId → 실제 사용량 */
      overrides?: Record<string, number>;
    }
  | { type: "undoMeal"; mealId: string; on: ISODate }
  | { type: "skipMeal"; mealId: string }
  | { type: "restoreMeal"; mealId: string }
  | { type: "deleteMeal"; mealId: string }
  | { type: "addMeal"; meal: NewMeal }
  | { type: "moveMeal"; mealId: string; date: ISODate; mealType: MealType }
  | { type: "consumeLot"; lotId: string; quantity: number; reason: "manual" | "discard"; on: ISODate }
  | { type: "moveLot"; lotId: string; quantity: number; to: StorageLocation }
  | { type: "addLot"; lot: NewLot }
  | { type: "addIngredient"; ingredient: Ingredient }
  | { type: "toggleSaveRecipe"; recipeId: string }
  | { type: "updateSettings"; settings: Partial<KitchenSettings> };

export interface NewMeal {
  id: string;
  date: ISODate;
  mealType: MealType;
  title: string;
  recipeId: string | null;
  source: MealPlan["source"];
  servings: number;
  items: Omit<MealPlanItem, "shortageQuantity">[];
}

export interface NewLot {
  id: string;
  ingredientId: string;
  storage: StorageLocation;
  quantity: number;
  unitCost: number | null;
  acquiredOn: ISODate;
  expiryDate: ISODate | null;
  sourceLabel: string | null;
}

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function recommendedUseBy(ingredient: Ingredient | undefined, storage: StorageLocation, from: ISODate): ISODate | null {
  const days = ingredient?.storageDays[storage];
  return days == null ? null : addDays(from, days);
}

function updateLot(lots: InventoryLot[], id: string, fn: (l: InventoryLot) => InventoryLot): InventoryLot[] {
  return lots.map((l) => (l.id === id ? fn(l) : l));
}

function deduct(lot: InventoryLot, qty: number, discard = false): InventoryLot {
  const remaining = Math.max(0, Number((lot.qtyRemaining - qty).toFixed(3)));
  return {
    ...lot,
    qtyRemaining: remaining,
    status: remaining > 0 ? "active" : discard ? "discarded" : "depleted",
  };
}

export function kitchenReducer(state: KitchenState, action: KitchenAction): KitchenState {
  switch (action.type) {
    case "replace":
      return action.state;

    case "completeMeal": {
      const meal = state.meals.find((m) => m.id === action.mealId);
      if (!meal || meal.status === "done") return state; // 중복 완료 방지
      let lots = state.lots;
      const logs: ConsumptionLog[] = [];
      const items = meal.items.map((item) => {
        const qty = action.overrides?.[item.ingredientId] ?? item.plannedQuantity;
        const r = allocateFIFO(lots, item.ingredientId, qty);
        for (const a of r.allocations) {
          lots = updateLot(lots, a.lotId, (l) => deduct(l, a.quantity));
          logs.push({
            id: uid("log"),
            lotId: a.lotId,
            ingredientId: item.ingredientId,
            quantity: a.quantity,
            unitCost: a.unitCost,
            cost: a.cost,
            reason: "meal",
            mealPlanId: meal.id,
            consumedOn: action.on,
          });
        }
        return { ...item, plannedQuantity: qty, shortageQuantity: r.shortage };
      });
      const actualCost = logs.reduce((s, l) => s + l.cost, 0);
      return {
        ...state,
        lots,
        logs: [...state.logs, ...logs],
        meals: state.meals.map((m) => (m.id === meal.id ? { ...m, items, status: "done", actualCost } : m)),
      };
    }

    case "undoMeal": {
      const meal = state.meals.find((m) => m.id === action.mealId);
      if (!meal || meal.status !== "done") return state;
      // 원 기록은 지우지 않고 반대 수량의 adjust 로그로 역분개한다.
      const mealLogs = state.logs.filter((l) => l.mealPlanId === meal.id);
      const net = new Map<string, ConsumptionLog & { net: number }>();
      for (const l of mealLogs) {
        const prev = net.get(l.lotId);
        net.set(l.lotId, { ...l, net: (prev?.net ?? 0) + l.quantity });
      }
      let lots = state.lots;
      const reversals: ConsumptionLog[] = [];
      for (const [lotId, l] of net) {
        if (l.net <= 0) continue;
        lots = updateLot(lots, lotId, (lot) => ({
          ...lot,
          qtyRemaining: Number((lot.qtyRemaining + l.net).toFixed(3)),
          status: "active",
        }));
        reversals.push({
          id: uid("log"),
          lotId,
          ingredientId: l.ingredientId,
          quantity: -l.net,
          unitCost: l.unitCost,
          cost: -Math.round(l.net * (l.unitCost ?? 0)),
          reason: "adjust",
          mealPlanId: meal.id,
          consumedOn: action.on,
        });
      }
      return {
        ...state,
        lots,
        logs: [...state.logs, ...reversals],
        meals: state.meals.map((m) =>
          m.id === meal.id
            ? { ...m, status: "planned", actualCost: null, items: m.items.map((i) => ({ ...i, shortageQuantity: 0 })) }
            : m,
        ),
      };
    }

    case "skipMeal":
      return {
        ...state,
        meals: state.meals.map((m) => (m.id === action.mealId && m.status === "planned" ? { ...m, status: "skipped" } : m)),
      };

    case "restoreMeal":
      return {
        ...state,
        meals: state.meals.map((m) => (m.id === action.mealId && m.status === "skipped" ? { ...m, status: "planned" } : m)),
      };

    case "deleteMeal": {
      const meal = state.meals.find((m) => m.id === action.mealId);
      if (!meal || meal.status === "done") return state; // 완료된 식사는 먼저 취소해야 삭제 가능
      return { ...state, meals: state.meals.filter((m) => m.id !== action.mealId) };
    }

    case "addMeal": {
      const meal: MealPlan = {
        ...action.meal,
        status: "planned",
        actualCost: null,
        createdAt: Date.now(),
        items: action.meal.items.map((i) => ({ ...i, shortageQuantity: 0 })),
      };
      return { ...state, meals: [...state.meals, meal] };
    }

    case "moveMeal":
      return {
        ...state,
        meals: state.meals.map((m) =>
          m.id === action.mealId && m.status !== "done" ? { ...m, date: action.date, mealType: action.mealType } : m,
        ),
      };

    case "consumeLot": {
      const lot = state.lots.find((l) => l.id === action.lotId);
      if (!lot || lot.status !== "active") return state;
      const qty = Math.min(action.quantity, lot.qtyRemaining);
      if (qty <= 0) return state;
      const log: ConsumptionLog = {
        id: uid("log"),
        lotId: lot.id,
        ingredientId: lot.ingredientId,
        quantity: qty,
        unitCost: lot.unitCost,
        cost: lot.unitCost == null ? 0 : Math.round(qty * lot.unitCost),
        reason: action.reason,
        mealPlanId: null,
        consumedOn: action.on,
      };
      return {
        ...state,
        lots: updateLot(state.lots, lot.id, (l) => deduct(l, qty, action.reason === "discard")),
        logs: [...state.logs, log],
      };
    }

    case "moveLot": {
      const lot = state.lots.find((l) => l.id === action.lotId);
      if (!lot || lot.status !== "active" || lot.storage === action.to) return state;
      const ing = state.ingredients.find((i) => i.id === lot.ingredientId);
      const qty = Math.min(action.quantity, lot.qtyRemaining);
      // 확인된 소비기한은 유지하고, 권장기한만 새 보관 위치 기준으로 다시 계산한다.
      const rec = recommendedUseBy(ing, action.to, lot.acquiredOn);
      if (qty >= lot.qtyRemaining - 1e-6) {
        return { ...state, lots: updateLot(state.lots, lot.id, (l) => ({ ...l, storage: action.to, recommendedUseBy: rec })) };
      }
      // 일부 이동 → 로트 분할 (단가·출처 유지)
      const split: InventoryLot = {
        ...lot,
        id: uid("lot"),
        storage: action.to,
        qtyInitial: qty,
        qtyRemaining: qty,
        recommendedUseBy: rec,
      };
      return {
        ...state,
        lots: [
          ...updateLot(state.lots, lot.id, (l) => ({
            ...l,
            qtyInitial: Number((l.qtyInitial - qty).toFixed(3)),
            qtyRemaining: Number((l.qtyRemaining - qty).toFixed(3)),
          })),
          split,
        ],
      };
    }

    case "addLot": {
      const ing = state.ingredients.find((i) => i.id === action.lot.ingredientId);
      const lot: InventoryLot = {
        id: action.lot.id,
        ingredientId: action.lot.ingredientId,
        storage: action.lot.storage,
        qtyInitial: action.lot.quantity,
        qtyRemaining: action.lot.quantity,
        unitCost: action.lot.unitCost,
        acquiredOn: action.lot.acquiredOn,
        expiryDate: action.lot.expiryDate,
        expirySource: action.lot.expiryDate ? "user" : null,
        recommendedUseBy: recommendedUseBy(ing, action.lot.storage, action.lot.acquiredOn),
        status: "active",
        sourceLabel: action.lot.sourceLabel,
      };
      return { ...state, lots: [...state.lots, lot] };
    }

    case "addIngredient":
      if (state.ingredients.some((i) => i.name === action.ingredient.name)) return state;
      return { ...state, ingredients: [...state.ingredients, action.ingredient] };

    case "toggleSaveRecipe":
      return {
        ...state,
        recipes: state.recipes.map((r) => (r.id === action.recipeId ? { ...r, saved: !r.saved } : r)),
      };

    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.settings } };
  }
}
