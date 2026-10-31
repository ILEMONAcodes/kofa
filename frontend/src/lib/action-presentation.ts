import type { ButtonVariant } from "@/components/common/button";
const emphasizedActions = new Set([
  "Open record →",
  "View details →",
  "Explore properties",
  "Browse properties",
  "Start a general inquiry",
  "Review submission",
  "Preview selected photo",
]);
export function actionButtonVariant(
  label: string,
  source?: string,
): ButtonVariant {
  if (emphasizedActions.has(label)) return "primary";
  return source === "neutral"
    ? "secondary"
    : source === "subtle"
      ? "subtle"
      : "primary";
}
