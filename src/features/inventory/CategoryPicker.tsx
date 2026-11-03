"use client";

import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/domain/category";

export function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="분류" className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => {
        const on = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c)}
            className={cn(
              "h-8 rounded-full border px-3 text-[13.5px]",
              on ? "border-ink bg-ink font-semibold text-white" : "border-line bg-bg text-ink active:bg-subtle",
            )}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
