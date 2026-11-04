import { diffDays, isISODate } from "@/lib/date";
import { guessCategory, suggestStorage } from "@/lib/domain/category";
import type { AnalysisDraft, BaseUnit, DraftItem, Ingredient, ISODate } from "@/lib/domain/types";
import type { ExtractedItem, ReceiptExtraction, ReceiptKind } from "./schema";

/**
 * AI 추출 결과 → 검수용 초안. 여기서부터는 전부 일반 코드로 계산한다.
 * (설계 문서 4.1 Step 3: 단위 정규화 · 재료 매칭 · 할인 배분 · 단위 가격 · 합계 검증 · 소비기한 파싱)
 */

let seq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

// ---------------------------------------------------------------- 단위

const WEIGHT: Record<string, number> = { g: 1, 그램: 1, kg: 1000, 킬로: 1000, 킬로그램: 1000 };
const VOLUME: Record<string, number> = { ml: 1, 밀리리터: 1, l: 1000, 리터: 1000 };
const COUNT = ["개", "구", "입", "알", "봉", "봉지", "팩", "마리", "단", "통", "모", "대", "송이", "포기", "ea", "pcs", "쪽"];

export interface NormalizedQty {
  unit: BaseUnit;
  /** 1팩당 기준 단위 수량 */
  perPack: number;
  eaLabel?: string;
}

/** 표기 단위 → 기준 단위 (g / ml / ea). 알 수 없으면 null */
export function normalizeUnit(size: number | null, unitRaw: string | null): NormalizedQty | null {
  if (!unitRaw) return null;
  const u = unitRaw.trim().toLowerCase().replace(/\s+/g, "");
  const s = size ?? (COUNT.includes(u) ? 1 : null);
  if (s == null || !(s > 0)) return null;
  if (u in WEIGHT) return { unit: "g", perPack: s * WEIGHT[u] };
  if (u in VOLUME) return { unit: "ml", perPack: s * VOLUME[u] };
  if (COUNT.includes(u)) return { unit: "ea", perPack: s, eaLabel: u === "구" || u === "알" || u === "ea" || u === "pcs" ? "개" : u };
  return null;
}

/** 상품명에서 "900ml", "1kg", "30구" 같은 용량 표기 찾기 (AI가 pack_size를 비워 둔 경우 보조) */
export function sizeFromName(name: string): { size: number; unit: string } | null {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|mL|ML|l|L|리터|구|입|개)(?![a-zA-Z가-힣])/);
  if (!m) return null;
  return { size: Number(m[1].replace(",", ".")), unit: m[2] };
}

// ---------------------------------------------------------------- 이름 정리 · 매칭

const NOISE = [
  "국산", "국내산", "수입산", "유기농", "무농약", "친환경", "무항생제", "동물복지", "냉장", "생물", "프리미엄", "곰곰", "탐사",
  "신선", "햇", "특", "대용량", "실속", "가정용", "1등급", "1+등급", "한우", "한돈", "기획", "증정", "행사",
];

/** 같은 재료를 부르는 다른 이름 → 대표 이름 */
const SYNONYMS: Record<string, string[]> = {
  계란: ["달걀", "특란", "대란", "왕란", "중란", "유정란", "구운란"],
  대파: ["흙대파", "손질대파"],
  우유: ["흰우유"],
  현미밥: ["현미 즉석밥"],
};

function canonical(name: string): string {
  const n = norm(name);
  for (const [canon, words] of Object.entries(SYNONYMS)) {
    if (words.some((w) => n.includes(norm(w)))) return canon;
  }
  return name;
}

/** 영수증 상품명 → 식재료 이름 후보 (괄호·용량·수식어 제거) */
export function cleanName(raw: string): string {
  let n = raw
    .replace(/\[[^\]]*\]|\([^)]*\)|【[^】]*】/g, " ")
    .replace(/\d+(?:[.,]\d+)?\s*(kg|g|ml|mL|l|L|구|입|개|팩|봉|ea|EA|x|X|×)/g, " ")
    .replace(/[x×*]\s*\d+/g, " ")
    .replace(/[,/·_+-]/g, " ")
    // 숫자가 섞인 토큰(1A, 2입 등)과 홀로 남은 x 기호 제거
    .replace(/(^|\s)\S*\d\S*(?=\s|$)/g, " ")
    .replace(/(^|\s)[x×*](?=\s|$)/g, " ");
  for (const w of NOISE) n = n.replace(new RegExp(`(^|\\s)${w}(?=\\s|$)`, "g"), " ");
  n = n.replace(/\s+/g, " ").trim();
  // 브랜드가 앞에 붙는 경우가 많으므로 마지막 1~2 단어를 우선 쓴다
  const words = n.split(" ").filter(Boolean);
  if (words.length > 2) n = words.slice(-2).join(" ");
  const canon = canonical(n || raw);
  return canon !== (n || raw) ? canon : n || raw.trim();
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export interface MatchResult {
  ingredientId: string | null;
  matchedBy: DraftItem["matchedBy"];
}

/** 영수증 표기 → 기존 식재료. 확실한 경우에만 자동 연결 (나머지는 사용자가 고른다) */
export function matchIngredient(raw: string, ingredients: Ingredient[]): MatchResult {
  const r = norm(raw);
  const alias = ingredients.find((i) => (i.aliases ?? []).some((a) => norm(a) === r));
  if (alias) return { ingredientId: alias.id, matchedBy: "alias" };
  const syn = canonical(raw);
  if (syn !== raw) {
    const bySyn = ingredients.find((i) => norm(i.name) === norm(syn));
    if (bySyn) return { ingredientId: bySyn.id, matchedBy: "contains" };
  }
  const cleaned = norm(cleanName(raw));
  const exact = ingredients.find((i) => norm(i.name) === cleaned);
  if (exact) return { ingredientId: exact.id, matchedBy: "exact" };
  // 재료 이름이 상품명에 들어 있으면 가장 긴 것 (예: "국산콩 부침두부 300g" → 두부)
  const contained = ingredients
    .filter((i) => norm(i.name).length >= 2 && r.includes(norm(i.name)))
    .sort((a, b) => b.name.length - a.name.length);
  if (contained.length > 0) {
    // "딸기우유"에 "딸기"와 "우유"가 둘 다 걸리면 애매하므로 연결하지 않는다
    const best = contained[0];
    const ambiguous = contained.some((c) => c.id !== best.id && !norm(best.name).includes(norm(c.name)));
    if (!ambiguous) return { ingredientId: best.id, matchedBy: "contains" };
  }
  return { ingredientId: null, matchedBy: null };
}

// ---------------------------------------------------------------- 날짜

/** 이미지에 적힌 소비기한 표기 → YYYY-MM-DD. 확실히 날짜로 읽힐 때만 */
export function parseExpiry(text: string | null, purchasedOn: ISODate): ISODate | null {
  if (!text) return null;
  // 배송·주문·도착일은 소비기한이 아니다
  if (/배송|주문|도착|결제|출고|입고/.test(text)) return null;
  const t = text.replace(/\s+/g, "");
  const pad = (n: number) => String(n).padStart(2, "0");
  let m = t.match(/(20\d{2})[.\-/년](\d{1,2})[.\-/월](\d{1,2})/);
  if (m) return valid(`${m[1]}-${pad(+m[2])}-${pad(+m[3])}`);
  m = t.match(/(?<!\d)(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?!\d)/);
  if (m) return valid(`20${m[1]}-${pad(+m[2])}-${pad(+m[3])}`);
  m = t.match(/(?<!\d)(\d{1,2})[.\-/월](\d{1,2})일?(?!\d)/);
  if (m) {
    // 연도가 없으면 구매일 이후 가장 가까운 날짜
    const y = Number(purchasedOn.slice(0, 4));
    let d = `${y}-${pad(+m[1])}-${pad(+m[2])}`;
    if (isISODate(d) && diffDays(purchasedOn, d) < -7) d = `${y + 1}-${pad(+m[1])}-${pad(+m[2])}`;
    return valid(d);
  }
  return null;

  function valid(d: string): ISODate | null {
    if (!isISODate(d)) return null;
    const [, mo, da] = d.split("-").map(Number);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    // 구매일보다 한참 전이거나 3년 넘게 뒤면 날짜가 아닐 가능성이 높다
    const diff = diffDays(purchasedOn, d);
    return diff < -3 || diff > 365 * 3 ? null : d;
  }
}

// ---------------------------------------------------------------- 금액

/** 주문 전체 할인을 금액 비례로 배분. 반올림 잔차는 가장 큰 품목에 → 합계가 원 단위로 정확히 맞는다 */
export function allocateDiscount(prices: number[], discount: number): number[] {
  const total = prices.reduce((s, p) => s + Math.max(0, p), 0);
  if (!(discount > 0) || total <= 0) return prices.map(() => 0);
  const shares = prices.map((p) => Math.floor((Math.max(0, p) / total) * discount));
  const rest = discount - shares.reduce((s, x) => s + x, 0);
  const maxIdx = prices.reduce((mi, p, i) => (p > prices[mi] ? i : mi), 0);
  shares[maxIdx] += rest;
  return shares;
}

export function itemFinalPrice(item: Pick<DraftItem, "linePrice" | "lineDiscount" | "allocatedDiscount">): number {
  return Math.max(0, item.linePrice - item.lineDiscount - item.allocatedDiscount);
}

/** 원 / 기준단위 */
export function itemUnitCost(item: DraftItem): number | null {
  if (!item.quantity || item.quantity <= 0) return null;
  return itemFinalPrice(item) / item.quantity;
}

/** 할인 재배분 (품목 금액·포함 여부가 바뀔 때마다 다시 계산) */
export function reallocate(draft: AnalysisDraft): AnalysisDraft {
  const active = draft.items.filter((i) => i.include);
  const shares = allocateDiscount(
    active.map((i) => i.linePrice - i.lineDiscount),
    draft.discountTotal,
  );
  const byId = new Map(active.map((i, k) => [i.id, shares[k]]));
  return { ...draft, items: draft.items.map((i) => ({ ...i, allocatedDiscount: byId.get(i.id) ?? 0 })) };
}

export interface TotalCheck {
  itemsTotal: number;
  expected: number;
  totalPaid: number | null;
  /** totalPaid - expected (원). null = 결제 금액을 모름 */
  diff: number | null;
}

/** 품목 합계 − 전체 할인 + 배송비 = 결제 금액 인지 확인 */
export function checkTotals(draft: AnalysisDraft): TotalCheck {
  const itemsTotal = draft.items.filter((i) => i.include).reduce((s, i) => s + i.linePrice - i.lineDiscount, 0);
  const expected = itemsTotal - draft.discountTotal + draft.deliveryFee;
  return {
    itemsTotal,
    expected,
    totalPaid: draft.totalPaid,
    diff: draft.totalPaid == null ? null : draft.totalPaid - expected,
  };
}

// ---------------------------------------------------------------- 초안 만들기

function quantityText(e: ExtractedItem): string {
  const count = e.pack_count ?? 1;
  if (e.pack_size != null && e.pack_unit) return `${count} × ${e.pack_size}${e.pack_unit}`;
  if (e.pack_unit) return `${count}${e.pack_unit}`;
  return `${count}개`;
}

export function buildItem(e: ExtractedItem, ingredients: Ingredient[], purchasedOn: ISODate): DraftItem {
  const fromName = e.pack_size == null ? sizeFromName(e.raw_name) : null;
  const normalized = normalizeUnit(e.pack_size ?? fromName?.size ?? null, e.pack_unit ?? fromName?.unit ?? null);
  const count = e.pack_count && e.pack_count > 0 ? e.pack_count : 1;
  const match = e.is_food ? matchIngredient(e.raw_name, ingredients) : { ingredientId: null, matchedBy: null };
  const matched = match.ingredientId ? ingredients.find((i) => i.id === match.ingredientId) : undefined;

  // 연결된 재료와 단위가 다르면 수량을 확정할 수 없다 (예: 재료는 g인데 영수증은 '1단')
  let quantity: number | null = normalized ? Number((normalized.perPack * count).toFixed(3)) : null;
  // 같은 '개수' 단위라도 이름이 다르면(1단 ≠ 1대) 환산할 수 없다
  const eaMismatch =
    matched?.baseUnit === "ea" &&
    normalized?.unit === "ea" &&
    !!normalized.eaLabel &&
    normalized.eaLabel !== "개" &&
    normalized.eaLabel !== (matched.eaLabel ?? "개");
  if (eaMismatch) quantity = null;
  if (matched && normalized && matched.baseUnit !== normalized.unit) {
    quantity =
      matched.baseUnit === "g" && normalized.unit === "ea" && matched.gramsPerEa
        ? normalized.perPack * count * matched.gramsPerEa
        : null;
  }

  const newName = cleanName(e.raw_name);
  const category = guessCategory(newName) ?? "기타";
  const expiry = parseExpiry(e.expiry_text, purchasedOn);
  return {
    id: newId("di"),
    rawName: e.raw_name,
    include: true,
    isFood: e.is_food,
    ingredientId: match.ingredientId,
    newName,
    newUnit: matched?.baseUnit ?? normalized?.unit ?? "g",
    newCategory: category,
    matchedBy: match.matchedBy,
    quantity,
    quantityText: quantityText({ ...e, pack_size: e.pack_size ?? fromName?.size ?? null, pack_unit: e.pack_unit ?? fromName?.unit ?? null }),
    linePrice: Math.max(0, Math.round(e.line_price ?? 0)),
    lineDiscount: Math.max(0, Math.round(e.line_discount ?? 0)),
    allocatedDiscount: 0,
    storage: matched?.defaultStorage ?? suggestStorage(newName, category) ?? "fridge",
    expiryDate: expiry,
    expiryFromImage: expiry != null,
    confidence: e.confidence,
  };
}

const KIND_SOURCE: Record<ReceiptKind, AnalysisDraft["source"]> = { receipt: "receipt", coupang: "coupang", online: "online" };

export function buildDraft(
  ex: ReceiptExtraction,
  kind: ReceiptKind,
  ingredients: Ingredient[],
  today: ISODate,
  model: string | null,
): AnalysisDraft {
  const purchasedOn =
    ex.purchased_at && isISODate(ex.purchased_at) && diffDays(today, ex.purchased_at) <= 1 && diffDays(ex.purchased_at, today) < 365
      ? ex.purchased_at
      : today;
  const draft: AnalysisDraft = {
    id: newId("an"),
    source: KIND_SOURCE[kind],
    storeName: ex.store_name?.trim() || (kind === "coupang" ? "쿠팡 프레시" : ""),
    purchasedOn,
    orderNumber: ex.order_number,
    discountTotal: Math.max(0, Math.round(ex.discount_total ?? 0)),
    deliveryFee: Math.max(0, Math.round(ex.delivery_fee ?? 0)),
    totalPaid: ex.total_paid == null ? null : Math.round(ex.total_paid),
    items: ex.items.map((e) => buildItem(e, ingredients, purchasedOn)),
    notes: ex.notes,
    model,
    createdAt: Date.now(),
  };
  return reallocate(draft);
}

/** 직접 입력용 빈 초안 */
export function emptyDraft(kind: ReceiptKind, today: ISODate): AnalysisDraft {
  return {
    id: newId("an"),
    source: KIND_SOURCE[kind],
    storeName: kind === "coupang" ? "쿠팡 프레시" : "",
    purchasedOn: today,
    orderNumber: null,
    discountTotal: 0,
    deliveryFee: 0,
    totalPaid: null,
    items: [],
    notes: null,
    model: null,
    createdAt: Date.now(),
  };
}

export function blankItem(storage: DraftItem["storage"] = "fridge"): DraftItem {
  return {
    id: newId("di"),
    rawName: "",
    include: true,
    isFood: true,
    ingredientId: null,
    newName: "",
    newUnit: "g",
    newCategory: "기타",
    matchedBy: null,
    quantity: null,
    quantityText: "직접 입력",
    linePrice: 0,
    lineDiscount: 0,
    allocatedDiscount: 0,
    storage,
    expiryDate: null,
    expiryFromImage: false,
    confidence: "high",
  };
}

/** 승인 전에 반드시 채워야 할 것이 남았는지 */
export function itemIssues(item: DraftItem): string[] {
  if (!item.include || !item.isFood) return [];
  const issues: string[] = [];
  if (!item.ingredientId && !item.newName.trim()) issues.push("식재료 연결 필요");
  if (!item.quantity || item.quantity <= 0) issues.push("수량 확인 필요");
  if (item.expiryFromImage) issues.push("소비기한 확인");
  return issues;
}

/** 소비기한 확인은 경고만, 나머지는 승인을 막는다 */
export function blockingIssues(item: DraftItem): string[] {
  return itemIssues(item).filter((i) => i !== "소비기한 확인");
}

