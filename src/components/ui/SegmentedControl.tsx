"use client";

import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("grid rounded-xl bg-subtle p-[3px]", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-9 items-center justify-center gap-1 rounded-[9px] text-[14px] transition-colors",
              on ? "bg-bg font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "font-medium text-sub",
            )}
          >
            {o.label}
            {o.count != null && <span className="text-[12px] font-medium text-mute">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
