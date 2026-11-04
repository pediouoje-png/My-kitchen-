import Anthropic from "@anthropic-ai/sdk";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/receipt/schema";
import { aiConfigured, extractReceipt, ReceiptAnalysisError } from "@/server/ai/receipt-extractor";

// 이미지 여러 장 분석은 수십 초 걸릴 수 있다
export const maxDuration = 120;

const MAX_IMAGES = 10;
const MAX_BASE64 = 4_000_000; // Vercel 요청 본문 한도(4.5MB) 안쪽
const MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(body: AnalyzeResponse, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  // 로그인(Supabase Auth) 연결 전까지는 접근 코드로 API 비용 남용을 막는다
  const code = process.env.APP_ACCESS_CODE;
  if (code && request.headers.get("x-access-code") !== code) {
    return json({ ok: false, error: "access_code", message: "접근 코드가 필요해요." }, 401);
  }
  if (!aiConfigured()) {
    return json(
      { ok: false, error: "not_configured", message: "AI API 키가 설정되지 않았어요. 서버 환경변수 ANTHROPIC_API_KEY를 추가해 주세요." },
      503,
    );
  }

  let body: AnalyzeRequest;
  try {
    body = (await request.json()) as AnalyzeRequest;
  } catch {
    return json({ ok: false, error: "bad_request", message: "요청 형식이 올바르지 않아요." }, 400);
  }
  const images = Array.isArray(body?.images) ? body.images : [];
  const totalSize = images.reduce((s, i) => s + (typeof i?.data === "string" ? i.data.length : 0), 0);
  if (
    !["receipt", "coupang", "online"].includes(body?.kind) ||
    images.length === 0 ||
    images.length > MAX_IMAGES ||
    images.some((i) => typeof i?.data !== "string" || !MEDIA.has(i.mediaType)) ||
    totalSize > MAX_BASE64
  ) {
    return json({ ok: false, error: "bad_request", message: `이미지는 ${MAX_IMAGES}장, 합계 약 3MB까지 보낼 수 있어요.` }, 400);
  }

  try {
    const { result, model } = await extractReceipt({ kind: body.kind, images });
    return json({ ok: true, result, model }, 200);
  } catch (error) {
    if (error instanceof ReceiptAnalysisError) {
      return json({ ok: false, error: error.code, message: error.message }, 422);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ ok: false, error: "rate_limited", message: "요청이 많아요. 잠시 후 다시 시도해 주세요." }, 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ ok: false, error: "not_configured", message: "AI API 키가 올바르지 않아요. 키를 다시 확인해 주세요." }, 503);
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error("analysis bad request", error.message);
      return json({ ok: false, error: "bad_request", message: "이미지를 처리하지 못했어요. 다른 사진으로 시도해 주세요." }, 400);
    }
    console.error("analysis failed", error);
    return json({ ok: false, error: "upstream", message: "분석 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요." }, 502);
  }
}
