import { Suspense } from "react";
import { ClientReady } from "@/components/layout/ClientReady";
import { TabBar } from "@/components/layout/TabBar";

/** 하단 탭바가 있는 1차 화면 (홈 · 식단 · 추가 · 냉장고 · 추천) */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="pb-tabbar">
        <ClientReady>{children}</ClientReady>
      </main>
      <Suspense>
        <TabBar />
      </Suspense>
    </>
  );
}
