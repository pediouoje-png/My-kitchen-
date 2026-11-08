import { addDays } from "@/lib/date";
import { allocateFIFO } from "@/lib/domain/costing";
import { findReferenceNutrition } from "@/lib/domain/reference-nutrition";
import { blockingIssues, itemFinalPrice, itemUnitCost } from "@/lib/receipt/draft";
import type {
  ConsumptionLog,
  Ingredient,
  InventoryLot,
  ISODate,
  AnalysisDraft,
  KitchenNote,
  PurchaseItem,
  PurchaseRecord,
  KitchenSettings,
  KitchenState,
  MealPlan,
  MealPlanItem,
  MealType,
  Recipe,
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
  | { type: "addRecipe"; recipe: Recipe }
  | { type: "updateRecipe"; id: string; patch: Partial<Pick<Recipe, "title" | "description" | "cookMinutes" | "steps" | "saved">> }
  | { type: "linkMealRecipe"; mealId: string; recipeId: string }
  | { type: "updateIngredient"; id: string; patch: Partial<Omit<Ingredient, "id" | "baseUnit">> }
  | { type: "updateSettings"; settings: Partial<KitchenSettings> }
  | { type: "addNote"; note: KitchenNote }
  | { type: "updateNote"; id: string; patch: Partial<Pick<KitchenNote, "text" | "tag" | "done">> }
  | { type: "deleteNote"; id: string }
  | { type: "clearDoneNotes" }
  | { type: "deleteIngredient"; id: string }
  | { type: "setAnalysisDraft"; draft: AnalysisDraft | null }
  | { type: "approvePurchase"; draft: AnalysisDraft };

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

    case "addRecipe":
      if (state.recipes.some((r) => r.id === action.recipe.id)) return state;
      return { ...state, recipes: [...state.recipes, action.recipe] };

    case "updateRecipe":
      return {
        ...state,
        recipes: state.recipes.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };

    case "linkMealRecipe":
      return {
        ...state,
        meals: state.meals.map((m) => (m.id === action.mealId ? { ...m, recipeId: action.recipeId } : m)),
      };

    case "updateIngredient": {
      const before = state.ingredients.find((i) => i.id === action.id);
      if (!before) return state;
      const next = { ...before, ...action.patch };
      // 보관 권장 기간이 바뀌면 활성 로트의 권장기한을 다시 계산한다 (확인된 소비기한은 그대로)
      const lots =
        action.patch.storageDays === undefined
          ? state.lots
          : state.lots.map((l) =>
              l.ingredientId === next.id && l.status === "active"
                ? { ...l, recommendedUseBy: recommendedUseBy(next, l.storage, l.acquiredOn) }
                : l,
            );
      return { ...state, lots, ingredients: state.ingredients.map((i) => (i.id === next.id ? next : i)) };
    }

    case "addNote":
      return { ...state, notes: [action.note, ...(state.notes ?? [])] };

    case "updateNote":
      return {
        ...state,
        notes: (state.notes ?? []).map((n) => (n.id === action.id ? { ...n, ...action.patch } : n)),
      };

    case "deleteNote":
      return { ...state, notes: (state.notes ?? []).filter((n) => n.id !== action.id) };

    case "clearDoneNotes":
      return { ...state, notes: (state.notes ?? []).filter((n) => !n.done) };

    case "deleteIngredient":
      return deleteIngredient(state, action.id);

    case "setAnalysisDraft":
      return { ...state, pendingAnalysis: action.draft };

    case "approvePurchase":
      return approvePurchase(state, action.draft);

    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.settings } };
  }
}

/**
 * 분석 결과 승인 = 구매 내역 + 품목 + 재고 로트 + 별칭 학습을 한 번에 반영 (DB 단계: approve_purchase() 트랜잭션).
 * 확인이 필요한 품목이 하나라도 남아 있으면 아무것도 바꾸지 않는다.
 */
function approvePurchase(state: KitchenState, draft: AnalysisDraft): KitchenState {
  const included = draft.items.filter((i) => i.include);
  if (included.some((i) => blockingIssues(i).length > 0)) return state;

  let ingredients = state.ingredients;
  const lots: InventoryLot[] = [];
  const purchaseItems: PurchaseItem[] = [];
  const sourceLabel = draft.storeName.trim() || (draft.source === "coupang" ? "쿠팡 프레시" : "영수증");

  for (const item of included) {
    if (!item.isFood) {
      purchaseItems.push({
        rawName: item.rawName || item.newName,
        ingredientId: null,
        isFood: false,
        quantity: null,
        finalPrice: itemFinalPrice(item),
        unitCost: null,
        lotId: null,
      });
      continue;
    }

    // 1) 식재료: 기존 연결 → 같은 이름 → 새로 생성
    let ing = item.ingredientId ? ingredients.find((i) => i.id === item.ingredientId) : undefined;
    if (!ing) ing = ingredients.find((i) => i.name === item.newName.trim());
    if (!ing) {
      const name = item.newName.trim();
      const ref = findReferenceNutrition(name, item.newUnit);
      ing = {
        id: uid("ing"),
        name,
        category: item.newCategory,
        baseUnit: item.newUnit,
        defaultStorage: item.storage,
        storageDays: {},
        nutrition: ref?.nutrition ?? null,
        gramsPerEa: ref?.gramsPerEa,
        aliases: [],
      };
      ingredients = [...ingredients, ing];
    }
    // 2) 영수증 표기를 별칭으로 학습 → 다음 분석에서 자동 연결
    const raw = item.rawName.trim();
    if (raw && raw !== ing.name && !(ing.aliases ?? []).includes(raw)) {
      const learned = { ...ing, aliases: [...(ing.aliases ?? []), raw] };
      ingredients = ingredients.map((i) => (i.id === learned.id ? learned : i));
      ing = learned;
    }

    // 3) 구매 건별 재고 로트 (단가는 입고 시점에 고정)
    const unitCost = itemUnitCost(item);
    const lot: InventoryLot = {
      id: uid("lot"),
      ingredientId: ing.id,
      storage: item.storage,
      qtyInitial: item.quantity!,
      qtyRemaining: item.quantity!,
      unitCost,
      acquiredOn: draft.purchasedOn,
      expiryDate: item.expiryDate,
      expirySource: item.expiryDate ? (item.expiryFromImage ? "ocr" : "user") : null,
      recommendedUseBy: recommendedUseBy(ing, item.storage, draft.purchasedOn),
      status: "active",
      sourceLabel,
    };
    lots.push(lot);
    purchaseItems.push({
      rawName: raw || ing.name,
      ingredientId: ing.id,
      isFood: true,
      quantity: item.quantity,
      finalPrice: itemFinalPrice(item),
      unitCost,
      lotId: lot.id,
    });
  }

  const record: PurchaseRecord = {
    id: uid("pur"),
    source: draft.source,
    storeName: draft.storeName.trim() || null,
    purchasedOn: draft.purchasedOn,
    orderNumber: draft.orderNumber,
    discountTotal: draft.discountTotal,
    deliveryFee: draft.deliveryFee,
    totalPaid: draft.totalPaid,
    items: purchaseItems,
    createdAt: Date.now(),
  };

  return {
    ...state,
    ingredients,
    lots: [...state.lots, ...lots],
    purchases: [record, ...(state.purchases ?? [])],
    pendingAnalysis: state.pendingAnalysis?.id === draft.id ? null : state.pendingAnalysis,
  };
}

/** 식재료 삭제가 미치는 영향 (확인 화면에 보여준다) */
export function ingredientUsage(state: KitchenState, id: string) {
  const lots = state.lots.filter((l) => l.ingredientId === id && l.status === "active" && l.qtyRemaining > 0);
  return {
    activeLots: lots.length,
    stock: lots.reduce((s, l) => s + l.qtyRemaining, 0),
    plannedMeals: state.meals.filter((m) => m.status !== "done" && m.items.some((i) => i.ingredientId === id)).length,
    recipes: state.recipes.filter((r) => r.ingredients.some((i) => i.ingredientId === id)).length,
    logs: state.logs.filter((l) => l.ingredientId === id).length,
  };
}

/**
 * 식재료 삭제 (잘못 입력한 재료 정리용).
 * - 식재료와 그 재고 로트를 지운다.
 * - 아직 먹지 않은 식단에서는 이 재료를 뺀다. 완료한 식사는 기록이므로 그대로 둔다.
 * - 레시피·구매 내역·검수 중인 분석에는 이름만 남기고 연결을 끊는다.
 * - 소비 기록(식비·폐기 금액)은 실제로 쓴 돈이므로 지우지 않는다.
 */
function deleteIngredient(state: KitchenState, id: string): KitchenState {
  if (!state.ingredients.some((i) => i.id === id)) return state;
  const removedLotIds = new Set(state.lots.filter((l) => l.ingredientId === id).map((l) => l.id));
  return {
    ...state,
    ingredients: state.ingredients.filter((i) => i.id !== id),
    lots: state.lots.filter((l) => l.ingredientId !== id),
    meals: state.meals.map((m) =>
      m.status === "done" || !m.items.some((i) => i.ingredientId === id)
        ? m
        : { ...m, items: m.items.filter((i) => i.ingredientId !== id) },
    ),
    recipes: state.recipes.map((r) =>
      r.ingredients.some((i) => i.ingredientId === id)
        ? { ...r, ingredients: r.ingredients.map((i) => (i.ingredientId === id ? { ...i, ingredientId: null } : i)) }
        : r,
    ),
    purchases: state.purchases?.map((p) => ({
      ...p,
      items: p.items.map((i) =>
        i.ingredientId === id || (i.lotId && removedLotIds.has(i.lotId)) ? { ...i, ingredientId: null, lotId: null } : i,
      ),
    })),
    pendingAnalysis: state.pendingAnalysis
      ? {
          ...state.pendingAnalysis,
          items: state.pendingAnalysis.items.map((i) => (i.ingredientId === id ? { ...i, ingredientId: null, matchedBy: null } : i)),
        }
      : state.pendingAnalysis,
  };
}
