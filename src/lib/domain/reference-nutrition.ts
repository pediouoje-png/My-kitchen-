import type { BaseUnit, Ingredient, Nutrition } from "./types";

/**
 * 일반 식재료 영양 참고값 (가식부 100g 기준, 생것 기준. 우유·간장 등 액체는 100ml).
 * 공개 식품성분표(USDA FoodData Central 등)의 대표값 수준이며, 실제 제품과 다를 수 있다.
 * 화면에는 항상 "참고값"으로 표시하고, 포장 라벨 값을 입력하면 그것을 우선한다.
 * 브랜드·조리법에 따라 편차가 큰 가공식품(햄, 라면, 어묵, 장류 등)은 넣지 않는다.
 */
interface RefEntry {
  names: string[];
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** 1개(대, 쪽 …) 가식부 중량 g — ea 단위 재료의 영양 환산용 */
  gramsPerEa?: number;
  liquid?: boolean;
}

const REF: RefEntry[] = [
  // 채소
  { names: ["대파", "파"], kcal: 27, protein: 1.5, fat: 0.3, carbs: 6, gramsPerEa: 100 },
  { names: ["쪽파", "실파"], kcal: 32, protein: 1.8, fat: 0.2, carbs: 7.3 },
  { names: ["양파"], kcal: 40, protein: 1.1, fat: 0.1, carbs: 9.3, gramsPerEa: 200 },
  { names: ["마늘", "깐마늘"], kcal: 149, protein: 6.4, fat: 0.5, carbs: 33, gramsPerEa: 5 },
  { names: ["생강"], kcal: 80, protein: 1.8, fat: 0.8, carbs: 18 },
  { names: ["배추", "알배추"], kcal: 16, protein: 1.2, fat: 0.2, carbs: 3.2 },
  { names: ["양배추"], kcal: 25, protein: 1.3, fat: 0.1, carbs: 5.8 },
  { names: ["상추", "로메인"], kcal: 15, protein: 1.4, fat: 0.2, carbs: 2.9 },
  { names: ["시금치"], kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6 },
  { names: ["브로콜리"], kcal: 34, protein: 2.8, fat: 0.4, carbs: 6.6 },
  { names: ["당근"], kcal: 41, protein: 0.9, fat: 0.2, carbs: 9.6, gramsPerEa: 150 },
  { names: ["감자"], kcal: 77, protein: 2, fat: 0.1, carbs: 17, gramsPerEa: 150 },
  { names: ["고구마"], kcal: 86, protein: 1.6, fat: 0.1, carbs: 20, gramsPerEa: 200 },
  { names: ["애호박", "주키니"], kcal: 17, protein: 1.2, fat: 0.3, carbs: 3.1, gramsPerEa: 300 },
  { names: ["오이"], kcal: 15, protein: 0.7, fat: 0.1, carbs: 3.6, gramsPerEa: 200 },
  { names: ["가지"], kcal: 25, protein: 1, fat: 0.2, carbs: 5.9, gramsPerEa: 150 },
  { names: ["양송이"], kcal: 22, protein: 3.1, fat: 0.3, carbs: 3.3 },
  { names: ["표고", "표고버섯"], kcal: 34, protein: 2.2, fat: 0.5, carbs: 6.8 },
  { names: ["느타리", "느타리버섯"], kcal: 33, protein: 3.3, fat: 0.4, carbs: 6.1 },
  { names: ["팽이", "팽이버섯"], kcal: 37, protein: 2.7, fat: 0.3, carbs: 7.8 },
  { names: ["숙주", "숙주나물"], kcal: 30, protein: 3, fat: 0.2, carbs: 5.9 },
  { names: ["파프리카"], kcal: 31, protein: 1, fat: 0.3, carbs: 6, gramsPerEa: 150 },
  { names: ["피망"], kcal: 20, protein: 0.9, fat: 0.2, carbs: 4.6, gramsPerEa: 100 },
  { names: ["풋고추", "청양고추"], kcal: 40, protein: 2, fat: 0.2, carbs: 9.5 },
  { names: ["토마토", "방울토마토"], kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9, gramsPerEa: 150 },
  { names: ["아스파라거스"], kcal: 20, protein: 2.2, fat: 0.1, carbs: 3.9 },
  { names: ["무"], kcal: 18, protein: 0.6, fat: 0.1, carbs: 4.1 },
  { names: ["아보카도"], kcal: 160, protein: 2, fat: 14.7, carbs: 8.5, gramsPerEa: 150 },
  { names: ["레몬"], kcal: 29, protein: 1.1, fat: 0.3, carbs: 9.3, gramsPerEa: 100 },
  // 과일
  { names: ["바나나"], kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, gramsPerEa: 120 },
  { names: ["사과"], kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, gramsPerEa: 250 },
  { names: ["딸기"], kcal: 32, protein: 0.7, fat: 0.3, carbs: 7.7 },
  { names: ["블루베리"], kcal: 57, protein: 0.7, fat: 0.3, carbs: 14.5 },
  { names: ["귤", "감귤"], kcal: 53, protein: 0.8, fat: 0.3, carbs: 13.3, gramsPerEa: 80 },
  { names: ["오렌지"], kcal: 47, protein: 0.9, fat: 0.1, carbs: 11.8, gramsPerEa: 200 },
  { names: ["포도", "샤인머스캣"], kcal: 69, protein: 0.7, fat: 0.2, carbs: 18 },
  { names: ["키위"], kcal: 61, protein: 1.1, fat: 0.5, carbs: 14.7, gramsPerEa: 80 },
  // 육류
  { names: ["닭가슴살"], kcal: 109, protein: 23, fat: 1.2, carbs: 0 },
  { names: ["닭다리살", "닭정육"], kcal: 121, protein: 19.7, fat: 4.1, carbs: 0 },
  { names: ["닭안심"], kcal: 109, protein: 23, fat: 1.2, carbs: 0 },
  { names: ["닭고기", "생닭", "통닭"], kcal: 215, protein: 18.6, fat: 15.1, carbs: 0 },
  { names: ["돼지안심"], kcal: 120, protein: 21, fat: 3.5, carbs: 0 },
  { names: ["소고기다짐육", "다진소고기"], kcal: 215, protein: 18.6, fat: 15, carbs: 0 },
  // 수산
  { names: ["연어"], kcal: 208, protein: 20.4, fat: 13.4, carbs: 0 },
  { names: ["새우", "칵테일새우", "흰다리새우"], kcal: 85, protein: 20.1, fat: 0.5, carbs: 0 },
  { names: ["고등어"], kcal: 205, protein: 18.6, fat: 13.9, carbs: 0 },
  { names: ["오징어"], kcal: 92, protein: 15.6, fat: 1.4, carbs: 3.1 },
  { names: ["대구"], kcal: 82, protein: 17.8, fat: 0.7, carbs: 0 },
  { names: ["바지락", "조개"], kcal: 86, protein: 14.7, fat: 1, carbs: 3.6 },
  // 달걀 · 유제품 · 콩
  { names: ["계란", "달걀", "유정란"], kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7, gramsPerEa: 50 },
  { names: ["메추리알"], kcal: 158, protein: 13, fat: 11.1, carbs: 0.4, gramsPerEa: 10 },
  { names: ["우유", "흰우유"], kcal: 65, protein: 3.2, fat: 3.6, carbs: 4.8, liquid: true },
  { names: ["요거트", "요구르트", "플레인요거트"], kcal: 61, protein: 3.5, fat: 3.3, carbs: 4.7 },
  { names: ["그릭요거트"], kcal: 97, protein: 9, fat: 5, carbs: 4 },
  { names: ["모짜렐라", "모짜렐라치즈"], kcal: 300, protein: 22.2, fat: 22.4, carbs: 2.2 },
  { names: ["체다치즈"], kcal: 403, protein: 24.9, fat: 33.1, carbs: 1.3 },
  { names: ["버터"], kcal: 717, protein: 0.9, fat: 81, carbs: 0.1 },
  { names: ["두부", "부침두부", "찌개두부"], kcal: 84, protein: 9.3, fat: 4.6, carbs: 2 },
  // 곡류
  { names: ["쌀", "백미"], kcal: 365, protein: 7.1, fat: 0.7, carbs: 80 },
  { names: ["현미"], kcal: 370, protein: 7.9, fat: 2.9, carbs: 77 },
  { names: ["쌀밥", "흰밥", "밥", "즉석밥", "햇반"], kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, gramsPerEa: 210 },
  { names: ["현미밥"], kcal: 123, protein: 2.7, fat: 1, carbs: 25.6, gramsPerEa: 210 },
  { names: ["오트밀", "귀리", "오트"], kcal: 389, protein: 16.9, fat: 6.9, carbs: 66 },
  { names: ["파스타", "스파게티"], kcal: 371, protein: 13, fat: 1.5, carbs: 75 },
  { names: ["식빵"], kcal: 265, protein: 9, fat: 3.2, carbs: 49 },
  { names: ["밀가루", "중력분"], kcal: 364, protein: 10.3, fat: 1, carbs: 76 },
  // 양념 · 기름
  { names: ["간장", "진간장"], kcal: 53, protein: 8.1, fat: 0.6, carbs: 4.9, liquid: true },
  { names: ["설탕"], kcal: 387, protein: 0, fat: 0, carbs: 100 },
  { names: ["꿀"], kcal: 304, protein: 0.3, fat: 0, carbs: 82 },
  { names: ["참기름", "들기름", "올리브유", "식용유", "카놀라유"], kcal: 884, protein: 0, fat: 100, carbs: 0 },
  { names: ["마요네즈"], kcal: 680, protein: 1, fat: 75, carbs: 0.6 },
  { names: ["케첩"], kcal: 101, protein: 1, fat: 0.1, carbs: 27 },
  { names: ["김치", "배추김치"], kcal: 18, protein: 1.6, fat: 0.4, carbs: 3.3 },
  // 견과
  { names: ["아몬드"], kcal: 579, protein: 21, fat: 50, carbs: 22 },
  { names: ["땅콩"], kcal: 567, protein: 26, fat: 49, carbs: 16 },
  { names: ["호두"], kcal: 654, protein: 15, fat: 65, carbs: 14 },
];

/** 이 단어가 이름에 있으면 가공품일 가능성이 높아 원재료 참고값을 쓰지 않는다 */
const PROCESSED = ["쿠키", "과자", "스낵", "칩", "소스", "드레싱", "시럽", "잼", "주스", "음료", "라떼", "맛", "아이스", "케이크", "빵", "라면", "볶음밥", "만두", "튀김", "까스", "스틱", "통조림", "캔", "소시지", "햄", "훈제", "양념", "가루", "분말", "순두부", "연두부", "저지방", "무지방"];

const norm = (s: string) => s.replace(/\s+/g, "");

export interface ReferenceMatch {
  nutrition: Nutrition;
  gramsPerEa?: number;
  matchedName: string;
}

/** 재료 이름 → 참고 영양값. 확실하지 않으면 null (억지로 맞추지 않는다) */
export function findReferenceNutrition(name: string, baseUnit: BaseUnit): ReferenceMatch | null {
  const n = norm(name);
  if (!n) return null;
  const hits: { entry: RefEntry; key: string }[] = [];
  for (const entry of REF) {
    for (const raw of entry.names) {
      const key = norm(raw);
      if (key.length >= 2 ? n.includes(key) : n === key) hits.push({ entry, key });
    }
  }
  if (hits.length === 0) return null;
  const best = hits.reduce((a, b) => (b.key.length > a.key.length ? b : a));
  // "딸기우유"처럼 서로 다른 두 식품이 함께 걸리면 무엇인지 확실하지 않으므로 쓰지 않는다
  if (hits.some((h) => h.entry !== best.entry && !best.key.includes(h.key))) return null;
  // "딸기우유", "버터쿠키"처럼 가공품으로 보이면 사용하지 않는다
  if (PROCESSED.some((w) => n.includes(w) && !best.key.includes(w))) return null;
  // 이름에서 매칭된 부분이 너무 작으면(수식어가 많으면) 신뢰하지 않는다
  if (n.length - best.key.length > 4) return null;

  const e = best.entry;
  const basis: Nutrition["basis"] = baseUnit === "ml" || e.liquid ? "per_100ml" : "per_100g";
  // ea 재료인데 개당 중량을 모르면 환산할 수 없으므로 적용하지 않는다
  if (baseUnit === "ea" && !e.gramsPerEa) return null;
  return {
    nutrition: { basis, kcal: e.kcal, protein: e.protein, fat: e.fat, carbs: e.carbs, source: "reference" },
    gramsPerEa: baseUnit === "ea" ? e.gramsPerEa : undefined,
    matchedName: best.key,
  };
}

/** 영양 정보가 비어 있는 재료에 참고값을 채운다 (이미 값이 있으면 건드리지 않음) */
export function withReferenceNutrition(ingredient: Ingredient): Ingredient {
  if (ingredient.nutrition) return ingredient;
  const ref = findReferenceNutrition(ingredient.name, ingredient.baseUnit);
  if (!ref) return ingredient;
  return {
    ...ingredient,
    nutrition: ref.nutrition,
    gramsPerEa: ingredient.gramsPerEa ?? ref.gramsPerEa,
  };
}
