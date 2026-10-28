import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  const tones = {
    neutral: "text-muted",
    success: "text-success",
    warning: "text-warning",
  };
  return (
    <span
      className={`inline-flex rounded-full bg-primary-tint px-3 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
