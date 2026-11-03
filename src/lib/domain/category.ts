import type { StorageLocation } from "./types";

/**
 * 식재료 분류. 이름 키워드로 기본값만 제안하고(규칙 기반, AI 미사용),
 * 최종 선택은 사용자가 한다.
 */
export const CATEGORIES = [
  "채소",
  "과일",
  "육류",
  "수산",
  "란류",
  "유제품",
  "콩류",
  "곡류",
  "반찬",
  "양념",
  "가공식품",
  "음료",
  "기타",
] as const;

export type Category = (typeof CATEGORIES)[number];

const KEYWORDS: [Category, string[]][] = [
  ["란류", ["계란", "달걀", "메추리알", "란"]],
  ["유제품", ["우유", "요거트", "요구르트", "치즈", "버터", "생크림", "크림"]],
  ["콩류", ["두부", "콩", "두유", "낫토", "유부"]],
  ["육류", ["닭고기", "닭가슴", "닭다리", "닭안심", "닭봉", "닭날개", "통닭", "소고기", "쇠고기", "돼지", "삼겹", "목살", "등심", "안심", "갈비", "베이컨", "햄", "소시지", "오리", "양고기", "다짐육", "다진고기"]],
  ["수산", ["새우", "연어", "고등어", "참치", "오징어", "문어", "조개", "굴", "멸치", "어묵", "명태", "대구", "갈치", "꽁치", "전복", "홍합", "게", "생선", "김", "미역", "다시마"]],
  ["곡류", ["쌀", "현미", "잡곡", "밥", "오트", "귀리", "면", "국수", "파스타", "스파게티", "빵", "식빵", "떡", "밀가루", "부침가루", "시리얼"]],
  ["반찬", ["김치", "깍두기", "장아찌", "젓갈", "나물", "무침", "조림"]],
  ["양념", ["된장", "고추장", "간장", "소금", "설탕", "식초", "참기름", "들기름", "올리브유", "식용유", "후추", "마요", "케첩", "소스", "쌈장", "액젓", "다시", "육수"]],
  ["과일", ["사과", "배", "바나나", "딸기", "포도", "귤", "오렌지", "레몬", "블루베리", "키위", "복숭아", "수박", "참외", "망고", "토마토", "아보카도"]],
  ["채소", ["대파", "쪽파", "실파", "양파", "마늘", "생강", "배추", "양배추", "상추", "시금치", "브로콜리", "당근", "감자", "고구마", "호박", "오이", "가지", "버섯", "양송이", "표고", "느타리", "팽이", "고추", "피망", "파프리카", "콩나물", "숙주", "무", "깻잎", "부추", "샐러드", "케일", "아스파라거스", "셀러리", "옥수수", "연근", "우엉"]],
  ["음료", ["주스", "커피", "차", "탄산", "생수", "콜라", "사이다"]],
  ["가공식품", ["라면", "만두", "통조림", "캔", "냉동식품", "즉석", "과자", "시리얼바"]],
];

/** 이름에서 분류를 추정한다. 맞는 키워드가 없으면 null (임의로 채우지 않음). */
export function guessCategory(name: string): Category | null {
  const n = name.replace(/\s+/g, "");
  if (!n) return null;
  // 긴 키워드가 먼저 맞도록 (예: "양송이"가 "양"보다 우선)
  let best: { cat: Category; len: number } | null = null;
  for (const [cat, words] of KEYWORDS) {
    for (const w of words) {
      if (w.length < 2 && n !== w) continue; // 한 글자 키워드는 정확히 일치할 때만
      if (n.includes(w) && (!best || w.length > best.len)) best = { cat, len: w.length };
    }
  }
  return best?.cat ?? null;
}

const CATEGORY_STORAGE: Partial<Record<Category, StorageLocation>> = {
  채소: "fridge",
  과일: "fridge",
  육류: "fridge",
  수산: "fridge",
  란류: "fridge",
  유제품: "fridge",
  콩류: "fridge",
  반찬: "fridge",
  곡류: "pantry",
  양념: "pantry",
  가공식품: "pantry",
  음료: "fridge",
};

export function suggestStorage(name: string, category: string): StorageLocation | null {
  if (name.includes("냉동")) return "freezer";
  if (/감자|고구마|양파|바나나/.test(name)) return "pantry";
  return CATEGORY_STORAGE[category as Category] ?? null;
}
