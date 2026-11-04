import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ReceiptExtractionSchema, type AnalyzeRequest, type ReceiptExtraction } from "@/lib/receipt/schema";

/**
 * 영수증 · 주문내역 이미지 → 구조화 데이터 (Claude 비전 + 구조화 출력).
 * AI는 보이는 글자를 옮겨 적기만 하고, 계산은 클라이언트의 lib/receipt/draft.ts 가 한다.
 */

export const RECEIPT_PROMPT_VERSION = "receipt-v1";

const SYSTEM = `당신은 한국 식료품 영수증과 온라인 장보기(쿠팡 프레시 등) 주문내역 이미지를 읽어 구조화하는 도우미입니다.

원칙
- 이미지에 실제로 보이는 글자만 옮겨 적으세요. 보이지 않는 값은 추측하지 말고 null로 두세요.
- 계산하지 마세요. 합계를 맞추려고 숫자를 고치지 말고, 적힌 숫자를 그대로 옮기세요.
- 금액은 원 단위 정수로, 쉼표와 '원' 없이 적으세요. 할인 금액은 양수로 적으세요.
- 소비기한·유통기한은 해당 날짜가 이미지에 보일 때만 expiry_text에 적으세요. 배송 예정일, 주문일은 소비기한이 아닙니다.
- 여러 장의 이미지는 한 주문(한 영수증)을 위에서 아래로 나눠 찍은 것일 수 있고, 이웃한 이미지끼리 일부가 겹칠 수 있습니다. 겹친 부분에 두 번 나온 같은 품목은 한 번만 적으세요.
- 쿠팡 프레시 주문내역에서는 상품명, 수량, 상품별 금액, 쿠폰·즉시할인, 배송비, 결제금액을 찾으세요. "함께 구매하면 좋은 상품" 같은 추천 영역은 주문 품목이 아니므로 빼세요.
- 종이 영수증에서는 품목 줄의 금액(수량 반영된 금액)을 line_price로, 그 품목 바로 아래 '할인' 줄은 그 품목의 line_discount로 적으세요.
- 품목명 글자가 흐리거나 잘렸으면 읽은 만큼 적고 confidence를 low로 하세요.`;

const KIND_HINT: Record<AnalyzeRequest["kind"], string> = {
  receipt: "사용자가 '종이 영수증'이라고 선택했습니다.",
  coupang: "사용자가 '쿠팡 프레시 주문내역 캡처'라고 선택했습니다.",
  online: "사용자가 '온라인 장보기 주문내역 캡처'라고 선택했습니다.",
};

export class ReceiptAnalysisError extends Error {
  constructor(
    public readonly code: "refused" | "incomplete",
    message: string,
  ) {
    super(message);
  }
}

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function extractReceipt(req: AnalyzeRequest): Promise<{ result: ReceiptExtraction; model: string }> {
  const client = new Anthropic({ maxRetries: 1, timeout: 110_000 });
  const model = process.env.AI_MODEL_VISION || "claude-opus-5-5";

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...req.images.map(
      (img): Anthropic.Beta.BetaImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      }),
    ),
    {
      type: "text",
      text: `${KIND_HINT[req.kind]} 이미지 ${req.images.length}장에서 구매 정보와 품목을 추출해 주세요.`,
    },
  ];

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    // 정책상 거절되면 서버에서 권장 모델로 자동 재시도
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ReceiptExtractionSchema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new ReceiptAnalysisError("refused", "이 이미지는 분석할 수 없어요.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new ReceiptAnalysisError("incomplete", "분석 결과가 완전하지 않아요. 이미지를 나눠서 다시 시도해 주세요.");
  }
  return { result: response.parsed_output, model: response.model };
}
