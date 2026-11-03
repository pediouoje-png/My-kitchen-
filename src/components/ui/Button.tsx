import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dashed";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-green text-white border-green active:bg-green-strong disabled:bg-green/40 disabled:border-transparent",
  secondary: "bg-bg text-ink border-line active:bg-subtle disabled:text-mute",
  ghost: "bg-transparent text-sub border-transparent active:bg-subtle",
  danger: "bg-bg text-danger border-line active:bg-danger-soft",
  dashed: "bg-transparent text-sub border-dashed border-line-strong active:bg-subtle",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[14px] rounded-[10px]",
  md: "h-11 px-4 text-[15px] rounded-xl",
  lg: "h-[52px] px-5 text-[16px] rounded-[14px]",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

function classes({ variant = "secondary", size = "md", block, className }: BaseProps) {
  return cn(
    "inline-flex select-none items-center justify-center gap-1.5 border font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
    className,
  );
}

export function Button({
  variant,
  size,
  block,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: BaseProps & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button type={type} className={classes({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function LinkButton({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...rest
}: BaseProps & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link className={classes({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: { label: string } & Omit<ComponentProps<"button">, "aria-label">) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors active:bg-subtle",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
