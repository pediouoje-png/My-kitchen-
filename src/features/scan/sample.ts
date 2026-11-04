import { addDays } from "@/lib/date";
import type { ISODate } from "@/lib/domain/types";
import type { ReceiptExtraction } from "@/lib/receipt/schema";

/**
 * API 키 설정 전에도 검수 → 승인 흐름을 써 볼 수 있는 예시 분석 결과.
 * 화면에는 항상 "예시 데이터"라고 표시한다.
 */
export function sampleExtraction(today: ISODate): ReceiptExtraction {
  return {
    source_type: "coupang",
    store_name: "쿠팡 프레시",
    purchased_at: addDays(today, -1),
    order_number: "예시-0001",
    items: [
      { raw_name: "서울우유 1A 우유 900ml", pack_count: 2, pack_size: 900, pack_unit: "ml", line_price: 4980, line_discount: 500, expiry_text: addDays(today, 10).replaceAll("-", "."), is_food: true, confidence: "high" },
      { raw_name: "국산콩 부침두부 300g", pack_count: 1, pack_size: 300, pack_unit: "g", line_price: 1980, line_discount: null, expiry_text: null, is_food: true, confidence: "high" },
      { raw_name: "흙대파 1단", pack_count: 1, pack_size: 1, pack_unit: "단", line_price: 2490, line_discount: null, expiry_text: null, is_food: true, confidence: "medium" },
      { raw_name: "곰곰 무항생제 특란 30구", pack_count: 1, pack_size: 30, pack_unit: "구", line_price: 8990, line_discount: null, expiry_text: null, is_food: true, confidence: "high" },
      { raw_name: "유기농 브로콜리", pack_count: 1, pack_size: null, pack_unit: null, line_price: 2990, line_discount: null, expiry_text: null, is_food: true, confidence: "low" },
      { raw_name: "탐사 키친타월 6롤", pack_count: 1, pack_size: null, pack_unit: null, line_price: 5900, line_discount: null, expiry_text: null, is_food: false, confidence: "high" },
    ],
    subtotal: 27330,
    discount_total: 1500,
    delivery_fee: 0,
    total_paid: 25330,
    notes: "예시 데이터예요. 실제 이미지를 분석한 결과가 아니에요.",
  };
}
