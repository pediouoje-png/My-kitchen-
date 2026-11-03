"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/misc";
import { DetailHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { useKitchen } from "@/lib/store/kitchen-store";

export function SettingsScreen() {
  const { state, dispatch, resetDemo } = useKitchen();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="pb-10">
      <DetailHeader title="설정" fallbackHref="/" />
      <div className="space-y-7 px-5 pt-2">
        <section>
          <h2 className="mb-1 text-[15px] font-semibold">임박 알림 기준</h2>
          <p className="mb-2.5 text-[13px] text-sub">확인된 소비기한이 며칠 남았을 때 ‘곧 소비기한’에 표시할까요?</p>
          <SegmentedControl
            label="임박 기준"
            value={String(state.settings.soonDays)}
            onChange={(v) => dispatch({ type: "updateSettings", settings: { soonDays: Number(v) } })}
            options={["1", "2", "3", "5", "7"].map((d) => ({ value: d, label: `D-${d}` }))}
          />
        </section>

        <section>
          <h2 className="mb-2 text-[15px] font-semibold">데이터</h2>
          <Card className="divide-y divide-line text-[15px]">
            <div className="flex justify-between px-4 py-3.5">
              <span className="text-sub">식재료</span>
              <span>{state.ingredients.length}개</span>
            </div>
            <div className="flex justify-between px-4 py-3.5">
              <span className="text-sub">식단 기록</span>
              <span>{state.meals.length}건</span>
            </div>
            <div className="flex justify-between px-4 py-3.5">
              <span className="text-sub">소비 기록</span>
              <span>{state.logs.length}건</span>
            </div>
          </Card>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-sub">
            지금은 미리보기 단계라 데이터가 이 기기의 브라우저에만 저장돼요. 데이터베이스 연결 후 계정에 안전하게 저장됩니다.
          </p>
          <Button variant="danger" block className="mt-3" onClick={() => setConfirm(true)}>
            예시 데이터로 초기화
          </Button>
        </section>

        <p className="text-center text-[12px] text-mute">MY KITCHEN · Phase 1 미리보기</p>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="예시 데이터로 초기화할까요?" description="지금까지 바꾼 식단·재고 기록이 모두 처음 상태로 돌아가요.">
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button size="lg" onClick={() => setConfirm(false)}>
            취소
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              resetDemo();
              setConfirm(false);
              toast("예시 데이터로 초기화했어요");
            }}
          >
            초기화
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
