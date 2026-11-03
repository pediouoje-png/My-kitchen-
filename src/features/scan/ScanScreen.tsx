"use client";

import { Camera, ImagePlus, PencilLine, ReceiptText, ShoppingBag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { AddLotSheet } from "@/features/inventory/AddLotSheet";

type Kind = "receipt" | "coupang" | "online";

const KIND_HINT: Record<Kind, string> = {
  receipt: "종이 영수증 전체가 보이도록 찍어 주세요.",
  coupang: "주문 상세 화면을 캡처해 주세요. 긴 화면은 여러 장으로 나눠도 돼요.",
  online: "주문 내역에 상품명·수량·금액이 보이도록 캡처해 주세요.",
};

interface Picked {
  url: string;
  name: string;
}

/**
 * 영수증 / 주문내역 업로드 화면.
 * Phase 1: 사진 선택·미리보기까지 동작. AI 분석과 검수 화면은 Phase 3에서 연결한다.
 */
export function ScanScreen() {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("receipt");
  const [files, setFiles] = useState<Picked[]>([]);
  const [manual, setManual] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const onPick = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .slice(0, 6)
      .map((f) => {
        const url = URL.createObjectURL(f);
        urls.current.push(url);
        return { url, name: f.name };
      });
    setFiles((prev) => [...prev, ...next].slice(0, 6));
  };

  return (
    <>
      <PageHeader title="추가" eyebrow="영수증 · 주문내역" />
      <div className="px-5">
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
            onClick={() => cameraRef.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-[14px] bg-green-soft text-green-ink active:opacity-80"
          >
            <Camera size={28} strokeWidth={1.5} className="text-green" />
            <span className="text-[15px] font-semibold">카메라로 촬영</span>
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-[14px] border border-line active:bg-subtle"
          >
            <ImagePlus size={28} strokeWidth={1.5} className="text-sub" />
            <span className="text-[15px] font-semibold">사진 보관함</span>
          </button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPick(e.target.files)} />
        <input ref={libraryRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />

        {files.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">선택한 이미지 {files.length}장</h2>
              <button type="button" className="text-[13.5px] text-sub" onClick={() => setFiles([])}>
                모두 지우기
              </button>
            </div>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {files.map((f, i) => (
                <div key={f.url} className="relative h-28 w-20 shrink-0 overflow-hidden rounded-[10px] border border-line bg-subtle">
                  {/* 로컬 미리보기(blob URL)라 next/image 최적화 대상이 아니다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`선택한 이미지 ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="이미지 빼기"
                    onClick={() => setFiles((p) => p.filter((x) => x.url !== f.url))}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="primary"
              size="lg"
              block
              className="mt-4"
              onClick={() => toast("AI 분석은 3단계에서 연결돼요. 지금은 직접 등록을 이용해 주세요.")}
            >
              분석 시작
            </Button>
          </section>
        )}

        <section className="mt-7">
          <h2 className="mb-2 text-[15px] font-semibold">분석 후 이렇게 연결돼요</h2>
          <ol className="space-y-2.5 rounded-[14px] bg-subtle px-4 py-4 text-[14px]">
            {[
              [ReceiptText, "상품명·수량·중량·가격을 읽어 초안을 만들어요"],
              [PencilLine, "내가 검수하고 승인한 내용만 저장돼요"],
              [ShoppingBag, "구매 건별 재고와 단위 가격이 자동 등록돼요"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof ReceiptText;
              return (
                <li key={i} className="flex items-center gap-2.5">
                  <I size={18} strokeWidth={1.6} className="shrink-0 text-green" />
                  <span>{text as string}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <button
          type="button"
          onClick={() => setManual(true)}
          className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-[14px] border border-line text-[15px] font-semibold active:bg-subtle"
        >
          <PencilLine size={17} strokeWidth={1.75} /> 영수증 없이 직접 등록
        </button>
      </div>

      <AddLotSheet open={manual} onClose={() => setManual(false)} defaultStorage="fridge" />
    </>
  );
}
