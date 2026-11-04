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
  /** 영수증 표기 별칭 — 승인할 때마다 학습해서 다음 분석의 자동 매칭에 쓴다 */
  aliases?: string[];
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

/** 구매 내역 (영수증 1장 = 1건) — purchase_records + purchase_items */
export interface PurchaseItem {
  rawName: string;
  ingredientId: string | null;
  isFood: boolean;
  /** 기준 단위 총량 (식품만) */
  quantity: number | null;
  /** 할인 반영 최종 금액 (원) */
  finalPrice: number;
  /** 원 / 기준단위 */
  unitCost: number | null;
  lotId: string | null;
}

export interface PurchaseRecord {
  id: string;
  source: "receipt" | "coupang" | "online" | "manual";
  storeName: string | null;
  purchasedOn: ISODate;
  orderNumber: string | null;
  discountTotal: number;
  deliveryFee: number;
  totalPaid: number | null;
  items: PurchaseItem[];
  createdAt: number;
}

/** 검수 중인 분석 결과 (image_analysis.draft) */
export interface DraftItem {
  id: string;
  rawName: string;
  include: boolean;
  isFood: boolean;
  /** 기존 식재료 연결 */
  ingredientId: string | null;
  /** 새 식재료로 만들 때의 이름 · 단위 · 분류 */
  newName: string;
  newUnit: BaseUnit;
  newCategory: string;
  matchedBy: "alias" | "exact" | "contains" | "user" | null;
  /** 기준 단위 총량. null = 확인 필요 */
  quantity: number | null;
  /** 이미지에 적힌 수량 표기 (예: 2 × 900ml) */
  quantityText: string;
  linePrice: number;
  lineDiscount: number;
  /** 주문 전체 할인 배분액 (코드 계산) */
  allocatedDiscount: number;
  storage: StorageLocation;
  expiryDate: ISODate | null;
  /** 이미지에서 읽은 소비기한인지 (사용자 확인 필요) */
  expiryFromImage: boolean;
  confidence: "high" | "medium" | "low";
}

export interface AnalysisDraft {
  id: string;
  source: "receipt" | "coupang" | "online";
  storeName: string;
  purchasedOn: ISODate;
  orderNumber: string | null;
  discountTotal: number;
  deliveryFee: number;
  totalPaid: number | null;
  items: DraftItem[];
  notes: string | null;
  model: string | null;
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
  purchases?: PurchaseRecord[];
  /** 검수 대기 중인 이미지 분석 (승인 전에는 재고에 반영되지 않는다) */
  pendingAnalysis?: AnalysisDraft | null;
  settings: KitchenSettings;
}
