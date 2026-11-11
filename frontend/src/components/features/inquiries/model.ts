import { parseMoneyInput } from "@/lib/formatters/money";
export const terminal = new Set(["closed_won", "closed_lost", "spam"]);
export function qualification(min: string, max: string, date: string) {
  const budget_min = min.trim() ? parseMoneyInput(min) : null,
    budget_max = max.trim() ? parseMoneyInput(max) : null;
  if (budget_min !== null && budget_max !== null && budget_min > budget_max)
    throw new Error("Minimum budget must not exceed maximum budget.");
  return { budget_min, budget_max, desired_move_in: date || null };
}
export const words = (s: string) => s.replaceAll("_", " ");
export const inquiryHref = (staff: boolean, id: string) =>
  `${staff ? "/staff/inquiry" : "/account/conversation"}?id=${encodeURIComponent(id)}`;
export function unread(record: { unread_count: number }) {
  return record.unread_count > 0;
}

const clientViews = new Set([
  "inquiry",
  "general-inquiry",
  "inquiry-received",
  "inquiries",
  "conversation",
  "message-sent",
]);
export const liveClientViews = clientViews;
export const liveInquiryStaffViews = new Set([
  "inquiries",
  "inquiry",
  "reply-recorded",
  "inquiry-updated",
  "qualification",
  "clients",
  "client",
  "client-saved",
]);
