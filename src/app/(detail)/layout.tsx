import { ClientReady } from "@/components/layout/ClientReady";

/** 상세 화면: 탭바 대신 화면별 하단 고정 액션 바를 사용한다. */
export default function DetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <ClientReady>{children}</ClientReady>
    </main>
  );
}
