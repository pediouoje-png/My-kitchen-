import { addDays } from "@/lib/date";
import { kitchenReducer, recommendedUseBy } from "@/lib/store/reducer";
import type {
  Ingredient,
  InventoryLot,
  ISODate,
  KitchenState,
  MealPlan,
  MealType,
  Recipe,
  StorageLocation,
} from "@/lib/domain/types";

/**
 * Phase 1 데모 데이터.
 * 날짜는 모두 "오늘" 기준 상대값으로 생성해 언제 실행해도 자연스럽게 보이도록 한다.
 * 영양값은 데모용 예시이며, 실제 서비스에서는 사용자 입력·포장 라벨·공공 DB만 사용한다.
 */

const ingredients: Ingredient[] = [
  { id: "tofu", name: "두부", category: "콩류", baseUnit: "g", defaultStorage: "fridge", storageDays: { fridge: 5 }, nutrition: { basis: "per_100g", kcal: 84, protein: 9.3, fat: 4.6, carbs: 2 } },
  { id: "milk", name: "우유", category: "유제품", baseUnit: "ml", defaultStorage: "fridge", storageDays: { fridge: 7 }, nutrition: { basis: "per_100ml", kcal: 65, protein: 3.2, fat: 3.6, carbs: 4.8 } },
  { id: "spinach", name: "시금치", category: "채소", baseUnit: "g", defaultStorage: "fridge", storageDays: { fridge: 5, freezer: 30 }, nutrition: { basis: "per_100g", kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6 } },
  { id: "zucchini", name: "애호박", category: "채소", baseUnit: "ea", eaLabel: "개", gramsPerEa: 300, defaultStorage: "fridge", storageDays: { fridge: 5 }, nutrition: { basis: "per_100g", kcal: 20, protein: 1.2, fat: 0.2, carbs: 3.9 } },
  { id: "scallion", name: "대파", category: "채소", baseUnit: "ea", eaLabel: "대", gramsPerEa: 100, defaultStorage: "fridge", storageDays: { fridge: 6, freezer: 60 }, nutrition: { basis: "per_100g", kcal: 27, protein: 1.5, fat: 0.3, carbs: 6 } },
  { id: "yogurt", name: "그릭요거트", category: "유제품", baseUnit: "g", defaultStorage: "fridge", storageDays: { fridge: 10 }, nutrition: { basis: "per_100g", kcal: 97, protein: 9, fat: 4, carbs: 4 } },
  { id: "egg", name: "계란", category: "란류", baseUnit: "ea", eaLabel: "개", gramsPerEa: 55, defaultStorage: "fridge", storageDays: { fridge: 21 }, nutrition: { basis: "per_100g", kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7 } },
  { id: "kimchi", name: "김치", category: "반찬", baseUnit: "g", defaultStorage: "fridge", storageDays: {}, nutrition: { basis: "per_100g", kcal: 18, protein: 1.6, fat: 0.4, carbs: 3.3 } },
  { id: "salmon", name: "연어", category: "수산", baseUnit: "g", defaultStorage: "fridge", storageDays: { fridge: 2, freezer: 60 }, nutrition: { basis: "per_100g", kcal: 208, protein: 20, fat: 13, carbs: 0 } },
  { id: "asparagus", name: "아스파라거스", category: "채소", baseUnit: "g", defaultStorage: "fridge", storageDays: { fridge: 4 }, nutrition: { basis: "per_100g", kcal: 20, protein: 2.2, fat: 0.1, carbs: 3.9 } },
  { id: "onion", name: "양파", category: "채소", baseUnit: "ea", eaLabel: "개", gramsPerEa: 200, defaultStorage: "pantry", storageDays: { pantry: 30, fridge: 45 }, nutrition: { basis: "per_100g", kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3 } },
  { id: "rice", name: "현미밥", category: "곡류", baseUnit: "ea", eaLabel: "개", gramsPerEa: 210, defaultStorage: "pantry", storageDays: {}, nutrition: { basis: "per_ea", kcal: 300, protein: 6.5, fat: 2, carbs: 64 } },
  { id: "doenjang", name: "된장", category: "양념", baseUnit: "g", defaultStorage: "pantry", storageDays: {}, nutrition: null },
  { id: "chicken", name: "닭가슴살", category: "육류", baseUnit: "g", defaultStorage: "freezer", storageDays: { freezer: 90, fridge: 2 }, nutrition: { basis: "per_100g", kcal: 109, protein: 23, fat: 1.2, carbs: 0 } },
  { id: "shrimp", name: "냉동 새우", category: "수산", baseUnit: "g", defaultStorage: "freezer", storageDays: { freezer: 90 }, nutrition: { basis: "per_100g", kcal: 99, protein: 24, fat: 0.3, carbs: 0.2 } },
  { id: "banana", name: "바나나", category: "과일", baseUnit: "ea", eaLabel: "개", gramsPerEa: 120, defaultStorage: "pantry", storageDays: { pantry: 5 }, nutrition: { basis: "per_100g", kcal: 89, protein: 1.1, fat: 0.3, carbs: 23 } },
  { id: "potato", name: "감자", category: "채소", baseUnit: "ea", eaLabel: "개", gramsPerEa: 150, defaultStorage: "pantry", storageDays: { pantry: 30 }, nutrition: { basis: "per_100g", kcal: 77, protein: 2, fat: 0.1, carbs: 17 } },
  { id: "mushroom", name: "양송이", category: "채소", baseUnit: "g", defaultStorage: "fridge", storageDays: { fridge: 5 }, nutrition: { basis: "per_100g", kcal: 22, protein: 3.1, fat: 0.3, carbs: 3.3 } },
  { id: "lettuce", name: "상추", category: "채소", baseUnit: "g", defaultStorage: "fridge", storageDays: { fridge: 4 }, nutrition: { basis: "per_100g", kcal: 15, protein: 1.4, fat: 0.2, carbs: 2.9 } },
];

interface LotSeed {
  id: string;
  ing: string;
  storage?: StorageLocation;
  qty: number;
  cost: number | null;
  acquired: number;
  expiry?: number;
  source: string | null;
  depleted?: boolean;
}

const lotSeeds: LotSeed[] = [
  // 가격 이력용 과거 로트 (소진)
  { id: "lot_milk_old", ing: "milk", qty: 900, cost: 2.4, acquired: -16, expiry: -5, source: "동네 마트", depleted: true },
  { id: "lot_tofu_old", ing: "tofu", qty: 300, cost: 5.9, acquired: -12, expiry: -4, source: "동네 마트", depleted: true },
  { id: "lot_egg_old", ing: "egg", qty: 10, cost: 320, acquired: -25, expiry: -2, source: "동네 마트", depleted: true },

  { id: "lot_tofu", ing: "tofu", qty: 300, cost: 6.6, acquired: -3, expiry: 1, source: "동네 마트" },
  { id: "lot_milk_1", ing: "milk", qty: 900, cost: 2.3, acquired: -8, expiry: 2, source: "쿠팡 프레시" },
  { id: "lot_milk_2", ing: "milk", qty: 900, cost: 2.1, acquired: -1, expiry: 11, source: "쿠팡 프레시" },
  { id: "lot_spinach", ing: "spinach", qty: 300, cost: 9.9, acquired: -6, source: "동네 마트" },
  { id: "lot_zucchini", ing: "zucchini", qty: 2, cost: 1290, acquired: -1, source: "쿠팡 프레시" },
  { id: "lot_scallion", ing: "scallion", qty: 3, cost: 830, acquired: -1, source: "쿠팡 프레시" },
  { id: "lot_yogurt", ing: "yogurt", qty: 800, cost: 8.9, acquired: -4, expiry: 6, source: "쿠팡 프레시" },
  { id: "lot_egg_1", ing: "egg", qty: 10, cost: 300, acquired: -10, expiry: 5, source: "동네 마트" },
  { id: "lot_egg_2", ing: "egg", qty: 15, cost: 280, acquired: -1, expiry: 19, source: "쿠팡 프레시" },
  { id: "lot_kimchi", ing: "kimchi", qty: 1500, cost: null, acquired: -20, source: null },
  { id: "lot_salmon", ing: "salmon", qty: 200, cost: 32, acquired: -1, expiry: 2, source: "쿠팡 프레시" },
  { id: "lot_onion", ing: "onion", qty: 5, cost: 450, acquired: -7, source: "동네 마트" },
  { id: "lot_rice", ing: "rice", qty: 6, cost: 1050, acquired: -12, expiry: 120, source: "쿠팡 프레시" },
  { id: "lot_doenjang", ing: "doenjang", qty: 500, cost: 1.6, acquired: -40, expiry: 200, source: "동네 마트" },
  { id: "lot_chicken", ing: "chicken", qty: 1000, cost: 9.9, acquired: -20, source: "쿠팡 프레시" },
  { id: "lot_shrimp", ing: "shrimp", qty: 400, cost: 18, acquired: -14, expiry: 150, source: "쿠팡 프레시" },
  { id: "lot_banana", ing: "banana", qty: 5, cost: 400, acquired: -3, source: "동네 마트" },
  { id: "lot_potato", ing: "potato", qty: 6, cost: 380, acquired: -4, source: "동네 마트" },
  { id: "lot_lettuce", ing: "lettuce", qty: 150, cost: 13, acquired: -9, source: "동네 마트" },
];

const recipes: Recipe[] = [
  {
    id: "r_tofu_kimchi", title: "두부 김치볶음", description: "익은 김치와 두부로 만드는 간단한 한 그릇.", source: "user", servings: 1, cookMinutes: 15, tags: ["한식", "단백질"], saved: true,
    ingredients: [
      { ingredientId: "tofu", name: "두부", quantity: 150, displayText: "두부 1/2모 (150g)" },
      { ingredientId: "kimchi", name: "김치", quantity: 120, displayText: "김치 120g" },
      { ingredientId: "scallion", name: "대파", quantity: 0.5, displayText: "대파 1/2대" },
      { ingredientId: null, name: "참기름", quantity: null, displayText: "참기름 약간", optional: true },
    ],
    steps: ["두부는 키친타월로 물기를 빼고 1cm 두께로 썬다.", "팬에 기름을 두르고 두부를 앞뒤로 노릇하게 굽는다.", "김치와 대파를 넣고 3~4분 볶는다.", "참기름을 둘러 마무리한다."],
  },
  {
    id: "r_yogurt_bowl", title: "그릭요거트 & 바나나", description: "아침에 빠르게 먹는 단백질 볼.", source: "user", servings: 1, cookMinutes: 3, tags: ["아침", "5분"], saved: true,
    ingredients: [
      { ingredientId: "yogurt", name: "그릭요거트", quantity: 150, displayText: "그릭요거트 150g" },
      { ingredientId: "banana", name: "바나나", quantity: 1, displayText: "바나나 1개" },
    ],
    steps: ["바나나를 한입 크기로 썬다.", "그릇에 요거트를 담고 바나나를 올린다."],
  },
  {
    id: "r_soybean_soup", title: "두부 시금치 된장국 & 계란말이", description: "소비기한이 가까운 두부와 시금치를 함께 쓰는 집밥 한 상.", source: "ai", servings: 1, cookMinutes: 20, tags: ["한식", "임박 재료"], saved: false,
    ingredients: [
      { ingredientId: "tofu", name: "두부", quantity: 100, displayText: "두부 100g" },
      { ingredientId: "spinach", name: "시금치", quantity: 100, displayText: "시금치 100g" },
      { ingredientId: "doenjang", name: "된장", quantity: 20, displayText: "된장 1큰술 (20g)" },
      { ingredientId: "egg", name: "계란", quantity: 2, displayText: "계란 2개" },
      { ingredientId: "scallion", name: "대파", quantity: 0.5, displayText: "대파 1/2대" },
    ],
    steps: ["물 400ml에 된장을 풀어 끓인다.", "깍둑 썬 두부를 넣고 3분 끓인다.", "시금치와 대파를 넣고 1분 더 끓인다.", "계란을 풀어 소금 약간을 넣고 팬에 얇게 부어 돌돌 만다."],
  },
  {
    id: "r_milk_risotto", title: "우유 버섯 리조또", description: "남은 우유와 즉석밥으로 만드는 크리미한 리조또.", source: "ai", servings: 1, cookMinutes: 25, tags: ["양식", "임박 재료"], saved: false,
    ingredients: [
      { ingredientId: "milk", name: "우유", quantity: 200, displayText: "우유 200ml" },
      { ingredientId: "rice", name: "현미밥", quantity: 1, displayText: "현미밥 1개" },
      { ingredientId: "onion", name: "양파", quantity: 0.5, displayText: "양파 1/2개" },
      { ingredientId: "mushroom", name: "양송이", quantity: 80, displayText: "양송이 4개 (80g)" },
      { ingredientId: null, name: "후추", quantity: null, displayText: "소금·후추 약간", optional: true },
    ],
    steps: ["양파와 양송이를 잘게 썬다.", "버터 또는 기름에 양파를 투명해질 때까지 볶는다.", "양송이와 밥을 넣고 볶다가 우유를 나눠 부으며 졸인다.", "소금·후추로 간한다."],
  },
  {
    id: "r_spinach_scramble", title: "시금치 계란 스크램블", description: "10분 안에 끝나는 고단백 아침.", source: "ai", servings: 1, cookMinutes: 10, tags: ["아침", "15분 이내"], saved: false,
    ingredients: [
      { ingredientId: "egg", name: "계란", quantity: 3, displayText: "계란 3개" },
      { ingredientId: "spinach", name: "시금치", quantity: 80, displayText: "시금치 80g" },
      { ingredientId: "milk", name: "우유", quantity: 30, displayText: "우유 2큰술 (30ml)" },
    ],
    steps: ["계란에 우유를 넣고 잘 푼다.", "팬에 시금치를 30초 볶는다.", "계란물을 붓고 약불에서 저어가며 익힌다."],
  },
  {
    id: "r_shrimp_egg", title: "새우 달걀볶음", description: "냉동 새우로 만드는 부드러운 중식 볶음.", source: "ai", servings: 1, cookMinutes: 15, tags: ["중식", "고단백"], saved: false,
    ingredients: [
      { ingredientId: "shrimp", name: "냉동 새우", quantity: 150, displayText: "새우 150g" },
      { ingredientId: "egg", name: "계란", quantity: 2, displayText: "계란 2개" },
      { ingredientId: "scallion", name: "대파", quantity: 0.5, displayText: "대파 1/2대" },
    ],
    steps: ["새우는 찬물에 해동해 물기를 뺀다.", "대파 기름을 낸 뒤 새우를 볶는다.", "풀어 둔 계란을 넣고 크게 저어 반숙으로 마무리한다."],
  },
  {
    id: "r_chicken_potato", title: "닭가슴살 감자조림", description: "넉넉히 만들어 두고 먹기 좋은 밑반찬.", source: "ai", servings: 1, cookMinutes: 30, tags: ["한식", "고단백"], saved: false,
    ingredients: [
      { ingredientId: "chicken", name: "닭가슴살", quantity: 200, displayText: "닭가슴살 200g" },
      { ingredientId: "potato", name: "감자", quantity: 2, displayText: "감자 2개" },
      { ingredientId: "onion", name: "양파", quantity: 1, displayText: "양파 1개" },
      { ingredientId: null, name: "간장", quantity: null, displayText: "간장 3큰술" },
    ],
    steps: ["닭가슴살과 감자를 한입 크기로 썬다.", "냄비에 재료와 간장, 물 200ml를 넣고 끓인다.", "중약불에서 국물이 자작해질 때까지 20분 조린다."],
  },
  {
    id: "r_salmon_steak", title: "연어 스테이크 & 구운 채소", description: "애호박과 아스파라거스를 곁들인 오븐 없는 연어 구이.", source: "ai", servings: 1, cookMinutes: 25, tags: ["양식", "고단백"], saved: false,
    ingredients: [
      { ingredientId: "salmon", name: "연어", quantity: 180, displayText: "연어 180g" },
      { ingredientId: "zucchini", name: "애호박", quantity: 0.5, displayText: "애호박 1/2개" },
      { ingredientId: "asparagus", name: "아스파라거스", quantity: 100, displayText: "아스파라거스 100g" },
    ],
    steps: ["연어에 소금·후추를 뿌려 10분 둔다.", "채소를 먹기 좋게 썰어 팬에 굽는다.", "연어 껍질 쪽부터 4분, 뒤집어 3분 굽는다."],
  },
  {
    id: "r_zucchini_pancake", title: "애호박 새우전", description: "애호박과 새우를 함께 부치는 간단한 전.", source: "ai", servings: 1, cookMinutes: 20, tags: ["한식"], saved: false,
    ingredients: [
      { ingredientId: "zucchini", name: "애호박", quantity: 1, displayText: "애호박 1개" },
      { ingredientId: "shrimp", name: "냉동 새우", quantity: 80, displayText: "새우 80g" },
      { ingredientId: "egg", name: "계란", quantity: 1, displayText: "계란 1개" },
    ],
    steps: ["애호박은 채 썰고 새우는 다진다.", "계란과 부침가루 약간을 넣어 반죽한다.", "팬에 한 숟가락씩 올려 앞뒤로 부친다."],
  },
  {
    id: "r_banana_smoothie", title: "바나나 우유 스무디", description: "바나나와 우유만으로 만드는 5분 간식.", source: "ai", servings: 1, cookMinutes: 5, tags: ["간식", "15분 이내"], saved: false,
    ingredients: [
      { ingredientId: "banana", name: "바나나", quantity: 1, displayText: "바나나 1개" },
      { ingredientId: "milk", name: "우유", quantity: 200, displayText: "우유 200ml" },
      { ingredientId: "yogurt", name: "그릭요거트", quantity: 50, displayText: "그릭요거트 50g", optional: true },
    ],
    steps: ["모든 재료를 블렌더에 넣고 30초 간다."],
  },
];

interface MealSeed {
  day: number;
  type: MealType;
  recipe?: string;
  title?: string;
  items?: [string, number][];
  done?: boolean;
  source?: MealPlan["source"];
}

const mealSeeds: MealSeed[] = [
  { day: -2, type: "breakfast", recipe: "r_yogurt_bowl", done: true },
  { day: -2, type: "dinner", title: "닭가슴살 샐러드", items: [["chicken", 150], ["lettuce", 80], ["onion", 0.5]], done: true, source: "manual" },
  { day: -1, type: "lunch", title: "계란볶음밥", items: [["egg", 2], ["rice", 1], ["scallion", 0.5], ["onion", 0.5]], done: true, source: "manual" },
  { day: -1, type: "dinner", title: "된장찌개", items: [["tofu", 150], ["zucchini", 0.5], ["potato", 1], ["doenjang", 30]], done: true, source: "manual" },
  { day: 0, type: "breakfast", recipe: "r_yogurt_bowl", done: true },
  { day: 0, type: "lunch", recipe: "r_tofu_kimchi" },
  { day: 0, type: "lunch", title: "현미밥", items: [["rice", 1]], source: "manual" },
  { day: 0, type: "dinner", recipe: "r_salmon_steak", source: "ai" },
  { day: 1, type: "breakfast", recipe: "r_yogurt_bowl" },
  { day: 1, type: "dinner", recipe: "r_shrimp_egg", source: "ai" },
  { day: 2, type: "lunch", recipe: "r_chicken_potato", source: "ai" },
  { day: 3, type: "dinner", title: "시금치 된장국", items: [["spinach", 100], ["tofu", 100], ["doenjang", 20]], source: "manual" },
];

export function createSeedState(today: ISODate): KitchenState {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const lots: InventoryLot[] = lotSeeds.map((s) => {
    const ing = byId.get(s.ing);
    const storage = s.storage ?? ing?.defaultStorage ?? "fridge";
    const acquiredOn = addDays(today, s.acquired);
    return {
      id: s.id,
      ingredientId: s.ing,
      storage,
      qtyInitial: s.qty,
      qtyRemaining: s.depleted ? 0 : s.qty,
      unitCost: s.cost,
      acquiredOn,
      expiryDate: s.expiry != null ? addDays(today, s.expiry) : null,
      expirySource: s.expiry != null ? "label" : null,
      recommendedUseBy: recommendedUseBy(ing, storage, acquiredOn),
      status: s.depleted ? "depleted" : "active",
      sourceLabel: s.source,
    };
  });

  let state: KitchenState = {
    ingredients,
    lots,
    logs: [],
    meals: [],
    recipes,
    settings: { soonDays: 3 },
  };

  // 식단 생성 → 지난 식사는 실제 완료 처리(FIFO 차감)를 거쳐 재고·로그를 일관되게 만든다.
  mealSeeds.forEach((m, idx) => {
    const recipe = m.recipe ? recipes.find((r) => r.id === m.recipe) : undefined;
    const items = recipe
      ? recipe.ingredients
          .filter((ri) => ri.ingredientId && ri.quantity != null && !ri.optional)
          .map((ri, j) => ({ id: `mi_${idx}_${j}`, ingredientId: ri.ingredientId!, plannedQuantity: ri.quantity! }))
      : (m.items ?? []).map(([ingredientId, q], j) => ({ id: `mi_${idx}_${j}`, ingredientId, plannedQuantity: q }));
    const id = `meal_${idx}`;
    const date = addDays(today, m.day);
    state = kitchenReducer(state, {
      type: "addMeal",
      meal: {
        id,
        date,
        mealType: m.type,
        title: recipe?.title ?? m.title ?? "메뉴",
        recipeId: recipe?.id ?? null,
        source: m.source ?? (recipe ? "recipe" : "manual"),
        servings: 1,
        items,
      },
    });
    if (m.done) state = kitchenReducer(state, { type: "completeMeal", mealId: id, on: date });
  });

  // 폐기 기록 예시: 오래된 상추 일부
  state = kitchenReducer(state, { type: "consumeLot", lotId: "lot_lettuce", quantity: 40, reason: "discard", on: addDays(today, -1) });

  // createdAt을 결정적으로 정렬
  state = { ...state, meals: state.meals.map((m, i) => ({ ...m, createdAt: i })) };
  return state;
}
