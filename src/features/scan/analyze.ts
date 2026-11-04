"use client";

import { prepareImages } from "@/lib/image/prepare";
import type { AnalyzeResponse, ReceiptKind } from "@/lib/receipt/schema";

const ACCESS_KEY = "my-kitchen:access-code";

export function getAccessCode(): string {
  try {
    return window.localStorage.getItem(ACCESS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    window.localStorage.setItem(ACCESS_KEY, code);
  } catch {
    // 저장이 막혀 있으면 이번 세션 동안만 입력값을 쓴다
  }
}

/** 원본 사진 미리보기 (검수 화면에서 대조용). 용량이 커서 저장하지 않고 이번 세션 메모리에만 둔다 */
let sessionPreviews: string[] = [];

export function setSessionPreviews(files: File[]) {
  sessionPreviews.forEach((u) => URL.revokeObjectURL(u));
  sessionPreviews = files.map((f) => URL.createObjectURL(f));
}

export function getSessionPreviews(): string[] {
  return sessionPreviews;
}

export type AnalyzeStage = "preparing" | "uploading";

export async function analyzeImages(
  kind: ReceiptKind,
  files: File[],
  onStage: (s: AnalyzeStage) => void,
  accessCode?: string,
): Promise<AnalyzeResponse> {
  onStage("preparing");
  let images;
  try {
    images = await prepareImages(files);
  } catch (e) {
    return { ok: false, error: "bad_request", message: e instanceof Error ? e.message : "이미지를 준비하지 못했어요." };
  }
  onStage("uploading");
  try {
    const res = await fetch("/api/analysis", {
      method: "POST",
      headers: { "content-type": "application/json", "x-access-code": accessCode ?? getAccessCode() },
      body: JSON.stringify({ kind, images }),
    });
    const body = (await res.json().catch(() => null)) as AnalyzeResponse | null;
    if (body && typeof body === "object" && "ok" in body) return body;
    return { ok: false, error: "upstream", message: `서버 응답을 읽지 못했어요 (${res.status}).` };
  } catch {
    return { ok: false, error: "upstream", message: "인터넷 연결을 확인하고 다시 시도해 주세요." };
  }
}
