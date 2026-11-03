/**
 * 도메인 타입 — docs/DESIGN.md 2장의 DB 스키마와 1:1로 대응한다.
 * Phase 1에서는 클라이언트 목업 저장소가 이 타입을 사용하고,
 * 이후 단계에서 Supabase 생성 타입과 매핑한다.
 */

export type BaseUnit = "g" | "ml" | "ea";
export type StorageLocation = "fridge" | "freezer" | "pantry";
export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type ExpirySource = "label" | "user" | "ocr";
export type ConsumptionReason = "meal" | "manual" | "discard" | "adjust";
export type LotStatus = "active" | "depleted" | "discarded";
export type MealStatus = "planned" | "done" | "skipped";

/** YYYY-MM-DD (Asia/Seoul 기준 로컬 날짜) */
export type ISODate = string;

/** label: 포장 라벨 · user: 직접 입력 · reference: 일반 식품성분표 참고값 */
export type NutritionSource = "label" | "user" | "reference";

export interface Nutrition {
  basis: "per_100g" | "per_100ml" | "per_ea";
  /** 없으면 직접 입력으로 간주 */
  source?: NutritionSource;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  baseUnit: BaseUnit;
  /** ea 재료의 표시 단위 (개, 대, 모 …) */
  eaLabel?: string;
  /** ea 재료 1개의 중량(g) — 영양 계산용 */
  gramsPerEa?: number;
  defaultStorage: StorageLocation;
  /** 보관 권장 기간(일). 소비기한이 아니다. */
  storageDays: Partial<Record<StorageLocation, number>>;
  /** null = 정보 없음 (0과 구분) */
  nutrition: Nutrition | null;
}

export interface InventoryLot {
  id: string;
  ingredientId: string;
  storage: StorageLocation;
  qtyInitial: number;
  qtyRemaining: number;
  /** 원 / 기준단위. null = 가격 정보 없음 */
  unitCost: number | null;
  acquiredOn: ISODate;
  /** 확인된 소비기한만 입력. 추측 금지. */
  expiryDate: ISODate | null;
  expirySource: ExpirySource | null;
  /** 보관 권장 기한 = acquiredOn + storageDays (참고용) */
  recommendedUseBy: ISODate | null;
  status: LotStatus;
  /** 구매처 표시용 (purchase_records 연결 전 임시) */
  sourceLabel: string | null;
}

export interface ConsumptionLog {
  id: string;
  lotId: string;
  ingredientId: string;
  /** 기준 단위. adjust만 음수 허용 */
  quantity: number;
  unitCost: number | null;
  cost: number;
  reason: ConsumptionReason;
  mealPlanId: string | null;
  consumedOn: ISODate;
}

export interface MealPlanItem {
  id: string;
  ingredientId: string;
  plannedQuantity: number;
  shortageQuantity: number;
}

export interface MealPlan {
  id: string;
  date: ISODate;
  mealType: MealType;
  title: string;
  recipeId: string | null;
  source: "recipe" | "ai" | "manual";
  servings: number;
  status: MealStatus;
  actualCost: number | null;
  createdAt: number;
  items: MealPlanItem[];
}

export interface RecipeIngredient {
  ingredientId: string | null;
  name: string;
  /** 기준 단위. null = 약간/적당량 */
  quantity: number | null;
  displayText: string;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  source: "ai" | "user";
  servings: number;
  cookMinutes: number;
  steps: string[];
  tags: string[];
  ingredients: RecipeIngredient[];
  saved: boolean;
}

export interface KitchenSettings {
  /** 임박 기준일 (D-n) */
  soonDays: number;
  /** 기존 재료에 영양 참고값을 채운 버전 (한 번만 실행) */
  referenceNutritionVersion?: number;
}

/** 홈 메모: order 주문·장보기 · prep 미리 준비(삶기, 손질 등) · etc 기타 */
export type NoteTag = "order" | "prep" | "etc";

export interface KitchenNote {
  id: string;
  text: string;
  tag: NoteTag;
  done: boolean;
  createdAt: number;
}

export interface KitchenState {
  ingredients: Ingredient[];
  lots: InventoryLot[];
  logs: ConsumptionLog[];
  meals: MealPlan[];
  recipes: Recipe[];
  /** 이전 버전 저장 데이터에는 없을 수 있다 */
  notes?: KitchenNote[];
  settings: KitchenSettings;
}
