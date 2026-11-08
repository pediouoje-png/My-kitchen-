"use client";

import { Copy, Download, Share } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { getInventorySnapshot, snapshotToCSV, snapshotToJSON, snapshotToText } from "@/lib/domain/inventory-snapshot";
import type { StorageLocation } from "@/lib/domain/types";
import { STORAGE_LABEL } from "@/lib/domain/units";
import { useKitchen } from "@/lib/store/kitchen-store";

type Format = "text" | "json" | "csv";
type Scope = "current" | "all";

/** 재고 내보내기: 텍스트(AI에 붙여넣기) · JSON · CSV(엑셀) */
export function ExportSheet({
  open,
  onClose,
  location,
  category,
}: {
  open: boolean;
  onClose: () => void;
  location: StorageLocation | "all";
  category: string | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="재고 내보내기" description="재료별 수량 · 보관 위치 · 소비기한">
      {open && <ExportBody location={location} category={category} />}
    </Sheet>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 권한이 없거나 오래된 브라우저 — 선택 후 복사로 대체
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function ExportBody({ location, category }: { location: StorageLocation | "all"; category: string | null }) {
  const { state, today } = useKitchen();
  const toast = useToast();
  const filtered = location !== "all" || !!category;
  const [scope, setScope] = useState<Scope>(filtered ? "current" : "all");
  const [format, setFormat] = useState<Format>("text");
  const [withQuestion, setWithQuestion] = useState(true);

  const currentLabel = [location === "all" ? "전체" : STORAGE_LABEL[location], category].filter(Boolean).join(" · ");

  const { content, count } = useMemo(() => {
    const snap = getInventorySnapshot(
      state,
      today,
      scope === "current" ? { location, category } : { location: "all", category: null },
    );
    const body =
      format === "text" ? snapshotToText(snap, { withQuestion }) : format === "json" ? snapshotToJSON(snap) : snapshotToCSV(snap);
    return { content: body, count: snap.itemCount };
  }, [state, today, scope, location, category, format, withQuestion]);

  const ext = format === "json" ? "json" : format === "csv" ? "csv" : "txt";
  const mime = format === "json" ? "application/json" : format === "csv" ? "text/csv" : "text/plain";
  const fileName = `my-kitchen-inventory-${today}.${ext}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const onCopy = async () => {
    const ok = await copyText(content.replace(/^﻿/, ""));
    toast(ok ? "복사했어요. 원하는 곳에 붙여 넣으세요" : "복사하지 못했어요. 미리보기를 길게 눌러 선택해 주세요");
  };

  const onShare = async () => {
    try {
      if (format !== "text") {
        const file = new File([content], fileName, { type: mime });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "내 냉장고 재고" });
          return;
        }
      }
      await navigator.share({ text: content.replace(/^﻿/, ""), title: "내 냉장고 재고" });
    } catch (e) {
      // 사용자가 공유 창을 닫은 경우는 조용히 넘어간다
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast("공유하지 못했어요. 복사하기를 이용해 주세요");
    }
  };

  const onDownload = () => {
    const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4 pt-2">
      {filtered && (
        <div>
          <p className="mb-1.5 text-[13px] text-sub">범위</p>
          <SegmentedControl
            label="내보낼 범위"
            value={scope}
            onChange={setScope}
            options={[
              { value: "current", label: `지금 목록 (${currentLabel})` },
              { value: "all", label: "전체 재고" },
            ]}
          />
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[13px] text-sub">형식</p>
        <SegmentedControl
          label="형식"
          value={format}
          onChange={setFormat}
          options={[
            { value: "text", label: "텍스트" },
            { value: "json", label: "JSON" },
            { value: "csv", label: "CSV (엑셀)" },
          ]}
        />
        <p className="mt-1.5 text-[12.5px] text-sub">
          {format === "text"
            ? "Claude 같은 AI나 메모에 붙여 넣기 좋아요."
            : format === "json"
              ? "다른 프로그램이나 AI 도구가 읽기 좋은 구조화 데이터예요."
              : "엑셀·구글 시트에서 열 수 있어요. 구매 건마다 한 줄이에요."}
        </p>
      </div>

      {format === "text" && (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-subtle px-3.5 py-3">
          <input
            type="checkbox"
            checked={withQuestion}
            onChange={(e) => setWithQuestion(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--color-green)]"
          />
          <span className="text-[14px]">
            <b className="block font-semibold">AI에게 물어볼 질문 넣기</b>
            <span className="text-[12.5px] text-sub">“소비기한 가까운 재료부터 쓰는 3일치 식단 추천” 문장을 끝에 붙여요</span>
          </span>
        </label>
      )}

      <div>
        <p className="mb-1.5 flex justify-between text-[13px] text-sub">
          <span>미리보기</span>
          <span>{count}개 재료</span>
        </p>
        <pre
          aria-label="내보낼 내용 미리보기"
          className="max-h-60 overflow-auto rounded-xl border border-line bg-subtle px-3.5 py-3 font-sans text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-ink"
        >
          {content.replace(/^﻿/, "")}
        </pre>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" size="lg" icon={<Copy size={18} />} onClick={onCopy} className={canShare ? "" : "col-span-2"}>
          복사하기
        </Button>
        {canShare && (
          <Button size="lg" icon={<Share size={18} />} onClick={onShare}>
            공유
          </Button>
        )}
        {format !== "text" && (
          <Button size="lg" block icon={<Download size={18} />} onClick={onDownload} className="col-span-2">
            파일로 저장 (.{ext})
          </Button>
        )}
      </div>
    </div>
  );
}
