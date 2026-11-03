import { cn } from "@/lib/cn";
import { MACRO_LABEL, type Macro } from "@/lib/domain/nutrition";

/** 탄·단·지 색상 — 채도 낮은 자연 계열, 라벨과 함께 쓰므로 색에만 의존하지 않는다 */
export const MACRO_COLOR: Record<Macro, string> = {
  carbs: "#a9c4b0",
  protein: "#4f7a5a",
  fat: "#d1a88c",
};

const TAG_CLASS: Record<Macro, string> = {
  carbs: "bg-[#eef4ef] text-[#55735d]",
  protein: "bg-green-soft text-green-ink",
  fat: "bg-[#f6ede6] text-[#9a6447]",
};

export function MacroTags({ macros, size = "sm", className }: { macros: Macro[]; size?: "sm" | "md"; className?: string }) {
  if (macros.length === 0) return null;
  return (
    <span className={cn("inline-flex gap-1", className)}>
      {macros.map((m) => (
        <span
          key={m}
          className={cn(
            "inline-flex items-center rounded font-semibold whitespace-nowrap",
            size === "sm" ? "h-[18px] px-1.5 text-[11px]" : "h-[22px] px-2 text-[12px]",
            TAG_CLASS[m],
          )}
        >
          {MACRO_LABEL[m]}
        </span>
      ))}
    </span>
  );
}
