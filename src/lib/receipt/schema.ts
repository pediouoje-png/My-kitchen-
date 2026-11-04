import { z } from "zod";

/**
 * AI 이미지 분석 결과 스키마 (영수증 · 쿠팡 프레시 주문내역).
 * AI는 "이미지에 보이는 글자"만 옮겨 적는다. 계산·추측은 하지 않는다.
 * 단위 환산, 재료 매칭, 할인 배분, 단위 가격, 합계 검증은 lib/receipt/draft.ts 의 코드가 한다.
 */
export const ExtractedItemSchema = z.object({
  raw_name: z.string().describe("상품명. 이미지에 적힌 그대로 (브랜드·용량 표기 포함)"),
  pack_count: z.number().nullable().describe("구매 수량(개수). 보이지 않으면 null"),
  pack_size: z.number().nullable().describe("1개당 용량 숫자. 예: '900ml'이면 900, '1kg'이면 1, '30구'면 30. 표기가 없으면 null"),
  pack_unit: z.string().nullable().describe("pack_size의 단위 표기 그대로. 예: g, kg, ml, L, 개, 구, 입, 봉, 팩, 단, 모. 없으면 null"),
  line_price: z.number().nullable().describe("이 품목 줄에 표시된 금액(원, 수량 반영된 줄 합계, 할인 전). 숫자만"),
  line_discount: z.number().nullable().describe("이 품목에만 적용된 할인 금액(원, 양수). 없으면 null"),
  expiry_text: z.string().nullable().describe("이미지에 소비기한/유통기한 날짜가 실제로 보일 때만 그 표기 그대로. 없으면 반드시 null"),
  is_food: z.boolean().describe("먹을 수 있는 식품이면 true. 키친타월·세제·비닐 등은 false"),
  confidence: z.enum(["high", "medium", "low"]).describe("글자가 흐리거나 잘려서 확실하지 않으면 low"),
});

export const ReceiptExtractionSchema = z.object({
  source_type: z.enum(["receipt", "coupang", "online_other", "unknown"]),
  store_name: z.string().nullable(),
  purchased_at: z.string().nullable().describe("구매일 또는 주문일. YYYY-MM-DD. 보이지 않으면 null"),
  order_number: z.string().nullable(),
  items: z.array(ExtractedItemSchema),
  subtotal: z.number().nullable().describe("상품 금액 합계(원). 보이지 않으면 null"),
  discount_total: z.number().nullable().describe("주문/영수증 전체에 적용된 할인·쿠폰 합계(원, 양수). 품목별 할인은 제외. 없으면 null"),
  delivery_fee: z.number().nullable().describe("배송비(원). 없으면 null"),
  total_paid: z.number().nullable().describe("최종 결제 금액(원). 보이지 않으면 null"),
  notes: z.string().nullable().describe("읽기 어려웠던 부분 등 사용자가 확인해야 할 점. 없으면 null"),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
export type ReceiptExtraction = z.infer<typeof ReceiptExtractionSchema>;

export type ReceiptKind = "receipt" | "coupang" | "online";

/** 클라이언트 → 서버 요청 */
export interface AnalyzeRequest {
  kind: ReceiptKind;
  images: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }[];
}

/** 서버 → 클라이언트 응답 */
export type AnalyzeResponse =
  | { ok: true; result: ReceiptExtraction; model: string }
  | {
      ok: false;
      error: "not_configured" | "access_code" | "bad_request" | "refused" | "incomplete" | "rate_limited" | "upstream";
      message: string;
    };
