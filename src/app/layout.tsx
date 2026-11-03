import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { KitchenProvider } from "@/lib/store/kitchen-store";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: { default: "MY KITCHEN", template: "%s · MY KITCHEN" },
  description: "식단과 식재료를 한곳에서 관리하는 개인용 키친 노트",
  applicationName: "MY KITCHEN",
  appleWebApp: { capable: true, title: "MY KITCHEN", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <KitchenProvider>
          <ToastProvider>
            <div className="relative mx-auto min-h-dvh max-w-[480px] bg-bg shadow-[0_0_0_1px_var(--color-line)]">
              {children}
            </div>
          </ToastProvider>
        </KitchenProvider>
      </body>
    </html>
  );
}
