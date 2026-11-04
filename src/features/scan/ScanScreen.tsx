"use client";

import { Camera, ChevronRight, ImagePlus, KeyRound, PencilLine, ReceiptText, ShoppingBag, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AddLotSheet } from "@/features/inventory/AddLotSheet";
import { formatMD } from "@/lib/date";
import type { AnalysisDraft } from "@/lib/domain/types";
import { formatWon } from "@/lib/domain/units";
import { buildDraft, emptyDraft } from "@/lib/receipt/draft";
import type { AnalyzeResponse, ReceiptKind } from "@/lib/receipt/schema";
import { useKitchen } from "@/lib/store/kitchen-store";
import { analyzeImages, getAccessCode, setAccessCode, setSessionPreviews, type AnalyzeStage } from "./analyze";
import { sampleExtraction } from "./sample";

const KIND_HINT: Record<ReceiptKind, string> = {
  receipt: "종이 영수증 전체가 보이도록, 구겨진 곳 없이 찍어 주세요.",
  coupang: "주문 상세 화면을 캡처해 주세요. 길면 여러 장으로 나눠도 돼요.",
  online: "주문 내역에 상품명·수량·금액이 보이도록 캡처해 주세요.",
};

const MAX_FILES = 6;

interface Picked {
  file: File;
  url: string;
}

type Failure = Extract<AnalyzeResponse, { ok: false }>;

/** 영수증 · 주문내역 업로드 → AI 분석 → 검수 화면 */
export function ScanScreen() {
  const { state, dispatch, today } = useKitchen();
  const router = useRouter();
  const [kind, setKind] = useState<ReceiptKind>("receipt");
  const [files, setFiles] = useState<Picked[]>([]);
  const [stage, setStage] = useState<AnalyzeStage | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [code, setCode] = useState("");
  const [manual, setManual] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const pending = state.pendingAnalysis;
  const purchases = (state.purchases ?? []).slice(0, 5);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const onPick = (list: FileList | null) => {
    if (!list) return;
    setFailure(null);
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.push(url);
        return { file, url };
      });
    setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
  };

  const openReview = (draft: AnalysisDraft) => {
    setFailure(null);
    dispatch({ type: "setAnalysisDraft", draft });
    router.push("/scan/review");
  };

  const run = async (accessCode?: string) => {
    if (files.length === 0 || stage) return;
    setFailure(null);
    const res = await analyzeImages(kind, files.map((f) => f.file), setStage, accessCode);
    setStage(null);
    // 서버가 접근 코드를 통과시켰으면(다른 이유로 실패했더라도) 이 기기에 기억한다
    if (accessCode && !(!res.ok && res.error === "access_code")) setAccessCode(accessCode);
    if (!res.ok) {
      setFailure(res);
      return;
    }
    setSessionPreviews(files.map((f) => f.file));
    setFiles([]);
    openReview(buildDraft(res.result, kind, state.ingredients, today, res.model));
  };

  const busy = stage != null;

  return (
    <>
      <PageHeader title="추가" eyebrow="영수증 · 주문내역" />
      <div className="px-5">
        {pending && (
          <Link
            href="/scan/review"
            className="mb-4 flex items-center gap-3 rounded-[14px] bg-green-soft py-3.5 pr-3.5 pl-4 active:opacity-80"
          >
            <ReceiptText size={22} className="shrink-0 text-green" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold text-green-ink">검수 중인 분석이 있어요</b>
              <span className="text-[13px] text-[#56715d]">
                {pending.storeName || "구매 내역"} · {pending.items.length}개 품목
              </span>
            </span>
            <ChevronRight size={18} className="text-[#56715d]" />
          </Link>
        )}

        <SegmentedControl
          label="유형"
          value={kind}
          onChange={setKind}
          options={[
            { value: "receipt", label: "영수증" },
            { value: "coupang", label: "쿠팡 프레시" },
            { value: "online", label: "기타 온라인" },
          ]}
        />
        <p className="mt-2.5 text-[13.5px] text-sub">{KIND_HINT[kind]}</p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-[14px] bg-green-soft text-green-ink active:opacity-80 disabled:opacity-50"
          >
            <Camera size={28} strokeWidth={1.5} className="text-green" />
            <span className="text-[15px] font-semibold">카메라로 촬영</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => libraryRef.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-[14px] border border-line active:bg-subtle disabled:opacity-50"
          >
            <ImagePlus size={28} strokeWidth={1.5} className="text-sub" />
            <span className="text-[15px] font-semibold">사진 보관함</span>
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="카메라로 촬영"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          aria-label="사진 선택"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />

        {files.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">
                선택한 이미지 {files.length}장{files.length >= MAX_FILES && <span className="font-normal text-sub"> (최대)</span>}
              </h2>
              {!busy && (
                <button type="button" className="text-[13.5px] text-sub" onClick={() => setFiles([])}>
                  모두 지우기
                </button>
              )}
            </div>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {files.map((f, i) => (
                <div key={f.url} className="relative h-28 w-20 shrink-0 overflow-hidden rounded-[10px] border border-line bg-subtle">
                  {/* 로컬 미리보기(blob URL)라 next/image 최적화 대상이 아니다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`선택한 이미지 ${i + 1}`} className="h-full w-full object-cover" />
                  {!busy && (
                    <button
                      type="button"
                      aria-label="이미지 빼기"
                      onClick={() => setFiles((p) => p.filter((x) => x.url !== f.url))}
                      className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {busy ? (
              <div aria-live="polite" className="mt-4 rounded-[14px] bg-subtle px-4 py-4">
                <p className="text-[15px] font-semibold">{stage === "preparing" ? "사진을 준비하는 중…" : "AI가 품목을 읽는 중…"}</p>
                <p className="mt-1 text-[13px] text-sub">
                  {stage === "preparing" ? "글자가 잘 보이도록 크기를 맞추고 있어요." : "보통 10~40초 걸려요. 화면을 켜 둔 채 기다려 주세요."}
                </p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
                  <div className={stage === "preparing" ? "h-full w-1/4 rounded-full bg-green" : "h-full w-2/3 animate-pulse rounded-full bg-green"} />
                </div>
              </div>
            ) : (
              <Button variant="primary" size="lg" block className="mt-4" icon={<Sparkles size={18} />} onClick={() => run()}>
                분석 시작
              </Button>
            )}
            {pending && !busy && <p className="mt-2 text-center text-[12.5px] text-sub">새로 분석하면 검수 중인 내용은 대체돼요.</p>}
          </section>
        )}

        {failure && (
          <FailureCard
            failure={failure}
            code={code}
            setCode={setCode}
            onRetry={() => run(code.trim() || getAccessCode())}
            onSample={() => openReview(buildDraft(sampleExtraction(today), "coupang", state.ingredients, today, null))}
            onManual={() => openReview(emptyDraft(kind, today))}
          />
        )}

        <section className="mt-7">
          <h2 className="mb-2 text-[15px] font-semibold">분석 후 이렇게 연결돼요</h2>
          <ol className="space-y-2.5 rounded-[14px] bg-subtle px-4 py-4 text-[14px]">
            {(
              [
                [ReceiptText, "상품명·수량·용량·가격을 읽어 초안을 만들어요"],
                [PencilLine, "내가 검수하고 승인한 내용만 저장돼요"],
                [ShoppingBag, "구매 건별 재고와 단위 가격이 자동 등록돼요"],
              ] as const
            ).map(([Icon, text], i) => (
              <li key={i} className="flex items-center gap-2.5">
                <Icon size={18} strokeWidth={1.6} className="shrink-0 text-green" />
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setManual(true)}
            className="flex h-12 items-center justify-center gap-1.5 rounded-[14px] border border-line text-[14.5px] font-semibold active:bg-subtle"
          >
            <PencilLine size={17} strokeWidth={1.75} /> 재료 직접 등록
          </button>
          <button
            type="button"
            onClick={() => openReview(emptyDraft(kind, today))}
            className="flex h-12 items-center justify-center gap-1.5 rounded-[14px] border border-line text-[14.5px] font-semibold active:bg-subtle"
          >
            <ReceiptText size={17} strokeWidth={1.75} /> 영수증 직접 입력
          </button>
        </div>

        {purchases.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-1 text-[15px] font-semibold">최근 구매</h2>
            <ul className="divide-y divide-line">
              {purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3 text-[14px]">
                  <span className="min-w-0">
                    <b className="block truncate font-semibold">{p.storeName ?? "구매"}</b>
                    <span className="text-[12.5px] text-sub">
                      {formatMD(p.purchasedOn)} · 식품 {p.items.filter((i) => i.isFood).length}개
                      {p.items.some((i) => !i.isFood) && ` · 기타 ${p.items.filter((i) => !i.isFood).length}개`}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatWon(p.totalPaid ?? p.items.reduce((s, i) => s + i.finalPrice, 0) + p.deliveryFee)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <AddLotSheet open={manual} onClose={() => setManual(false)} defaultStorage="fridge" />
    </>
  );
}

function FailureCard({
  failure,
  code,
  setCode,
  onRetry,
  onSample,
  onManual,
}: {
  failure: Failure;
  code: string;
  setCode: (v: string) => void;
  onRetry: () => void;
  onSample: () => void;
  onManual: () => void;
}) {
  if (failure.error === "not_configured") {
    return (
      <section role="alert" className="mt-4 rounded-[14px] border border-line p-4">
        <p className="text-[15px] font-semibold">AI 분석이 아직 연결되지 않았어요</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
          배포 서버(Vercel)의 환경변수에 <b className="font-semibold text-ink">ANTHROPIC_API_KEY</b>를 추가하면 바로 쓸 수 있어요.
          그전에는 예시 데이터로 검수 화면을 써 보거나, 영수증을 보면서 직접 입력할 수 있어요.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={onSample}>예시로 체험</Button>
          <Button onClick={onManual}>직접 입력</Button>
        </div>
      </section>
    );
  }
  if (failure.error === "access_code") {
    return (
      <section role="alert" className="mt-4 rounded-[14px] border border-line p-4">
        <p className="flex items-center gap-1.5 text-[15px] font-semibold">
          <KeyRound size={17} /> 접근 코드를 입력해 주세요
        </p>
        <p className="mt-1 text-[13px] text-sub">서버에 설정한 APP_ACCESS_CODE 값이에요. 한 번 맞히면 이 기기에 기억돼요.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            type="password"
            aria-label="접근 코드"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line px-3 outline-none focus:border-green"
          />
          <Button variant="primary" disabled={!code.trim()} onClick={onRetry}>
            확인
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section role="alert" className="mt-4 rounded-[14px] border border-[#e3c9a0] bg-warn-soft/50 p-4">
      <p className="text-[15px] font-semibold">분석하지 못했어요</p>
      <p className="mt-1 text-[13.5px] text-sub">{failure.message}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={onRetry}>다시 시도</Button>
        <Button onClick={onManual}>직접 입력</Button>
      </div>
    </section>
  );
}
