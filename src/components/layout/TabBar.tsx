"use client";

import { CalendarDays, Home, Plus, Refrigerator, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/", label: "홈", icon: Home, match: (p: string) => p === "/" },
  { href: "/planner", label: "식단", icon: CalendarDays, match: (p: string) => p.startsWith("/planner") },
  { href: "/scan", label: "추가", icon: Plus, center: true, match: (p: string) => p.startsWith("/scan") },
  { href: "/fridge", label: "냉장고", icon: Refrigerator, match: (p: string) => p.startsWith("/fridge") },
  { href: "/recipes", label: "추천", icon: Sparkles, match: (p: string) => p.startsWith("/recipes") },
] as const;

export function TabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-line bg-bg/95 backdrop-blur"
    >
      <ul className="flex h-[60px] items-stretch justify-around px-1.5">
        {TABS.map((tab) => {
          const on = tab.match(pathname);
          const Icon = tab.icon;
          if ("center" in tab) {
            return (
              <li key={tab.href} className="flex w-16 items-center justify-center">
                <Link
                  href={tab.href}
                  aria-label="영수증·재료 추가"
                  aria-current={on ? "page" : undefined}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-green text-white transition-colors active:bg-green-strong"
                >
                  <Icon size={24} strokeWidth={2} />
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.href} className="flex w-16">
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px]",
                  on ? "font-semibold text-ink" : "font-medium text-mute",
                )}
              >
                <Icon size={24} strokeWidth={1.6} className={on ? "text-green" : undefined} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
