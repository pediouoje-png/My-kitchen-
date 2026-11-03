import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ExpiryInfo, ExpiryTone } from "@/lib/domain/expiry";

export type BadgeTone = "green" | "warn" | "danger" | "gray" | "dashed";

const TONE: Record<BadgeTone, string> = {
  green: "bg-green-soft text-green",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  gray: "bg-subtle text-sub",
  dashed: "border border-dashed border-line-strong text-sub",
};

export function Badge({ tone = "gray", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center rounded-md px-2 text-[12px] font-semibold whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const EXPIRY_TONE: Record<ExpiryTone, BadgeTone> = {
  danger: "danger",
  warn: "warn",
  ok: "green",
  "rec-over": "gray",
  rec: "dashed",
  none: "gray",
};

/**
 * 확인된 소비기한(색상 배지)과 보관 권장기한(회색/점선 배지)을 시각적으로 구분한다.
 */
export function ExpiryBadge({ info, withPrefix, className }: { info: ExpiryInfo; withPrefix?: boolean; className?: string }) {
  const label = withPrefix && info.kind === "confirmed" ? `소비기한 ${info.label}` : info.label;
  return (
    <Badge tone={EXPIRY_TONE[info.tone]} className={className}>
      {label}
    </Badge>
  );
}
