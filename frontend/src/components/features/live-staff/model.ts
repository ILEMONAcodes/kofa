import { formatMoney } from "@/lib/formatters/money";
import { ApiError } from "@/lib/api/error";
export const liveStaffViews = [
  "overview",
  "properties",
  "property",
  "edit-property",
  "changes-saved",
  "evidence",
  "media",
  "remove-media",
  "document",
  "document-expired",
  "assign-review",
  "availability",
  "availability-updated",
  "landlords",
  "landlord",
  "listing-status",
  "unpublish",
  "listing-unpublished",
  "request-changes",
  "changes-requested",
  "landlord-response",
];
export const statuses = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "unpublished",
  "rejected",
  "archived",
];
export const words = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export const staffLink = (view: string, id?: string) =>
  `/staff/${view}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export function priceText(amount: number) {
  return Number.isSafeInteger(amount) && amount >= 0
    ? formatMoney(amount)
    : "Price needs review";
}
export function errorText(error: unknown) {
  if (error instanceof StaffInputError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === "INVALID_STATE_TRANSITION")
      return error.message;
    if (error.status === 409)
      return "This record changed or the action is unavailable. Reload the record before trying again.";
    if (error.status === 403)
      return "You no longer have permission to perform this action.";
    if (error.status === 401)
      return "Your session ended. Sign in again to continue.";
    if (error.status >= 500 || error.status === 0)
      return error.status === 0
        ? error.message
        : "This service is unavailable. Please try again.";
    return [error.message, ...error.details.map((d) => d.message)].join(" ");
  }
  return "Unable to complete this action. Please try again.";
}
export class StaffInputError extends Error {}
