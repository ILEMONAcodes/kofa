import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  loading?: boolean;
};
export function Button({
  className,
  variant = "primary",
  loading,
  disabled,
  children,
  type = "button",
  ...props
}: Props) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-primary text-inverse hover:bg-primary-hover"
          : "border border-input-border bg-surface text-primary hover:bg-primary-tint",
        className,
      )}
    >
      {loading && <span aria-hidden="true">…</span>}
      {children}
    </button>
  );
}
