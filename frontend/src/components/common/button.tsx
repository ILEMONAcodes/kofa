import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
export type ButtonVariant = "primary" | "secondary" | "accent" | "subtle";
export function buttonStyles(
  variant: ButtonVariant = "primary",
  className?: string,
) {
  const tones = {
    primary: "bg-primary text-inverse hover:bg-primary-hover",
    secondary:
      "border border-input-border bg-surface text-primary hover:bg-primary-tint",
    accent: "bg-accent text-ink hover:bg-primary-tint",
    subtle: "bg-surface text-primary hover:bg-primary-tint",
  };
  return cn(
    "inline-flex h-12 items-center justify-center gap-2 rounded-full px-3 py-3 text-base font-medium leading-6 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    tones[variant],
    className,
  );
}
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
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
      className={buttonStyles(variant, className)}
    >
      {loading && <span aria-hidden="true">…</span>}
      {children}
    </button>
  );
}
