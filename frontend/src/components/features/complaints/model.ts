export const words = (value: string) => value.replaceAll("_", " ");
export const statuses = [
  "new",
  "triage",
  "investigating",
  "resolved",
  "dismissed",
];
export const reasons = [
  "fake_listing",
  "wrong_price",
  "misleading_description",
  "already_let_or_sold",
  "unauthorised_agent",
  "asked_to_pay_outside",
  "other",
];
export const outcomes = [
  "substantiated",
  "partially_substantiated",
  "unsubstantiated",
  "inconclusive",
];
export const dismissReasons = [
  "duplicate",
  "spam_or_abuse",
  "out_of_scope",
  "insufficient_information",
];
export const opts = (values: readonly string[]) =>
  values.map((value) => ({ value, label: words(value) }));
export function evidenceError(files: File[]) {
  if (files.length > 3) return "Choose up to three evidence files.";
  if (files.some((f) => f.size > 5 * 1024 * 1024))
    return "Each file must be 5 MB or smaller.";
  if (
    files.some(
      (f) => !["image/jpeg", "image/png", "application/pdf"].includes(f.type),
    )
  )
    return "Choose JPEG, PNG or PDF files.";
  return "";
}
export const caseLink = (staff: boolean, id: string) =>
  `${staff ? "/staff/complaint" : "/account/complaint-detail"}?id=${encodeURIComponent(id)}`;
export const clientCaseViews = new Set([
  "complaints",
  "complaint-form",
  "complaint-received",
  "complaint-detail",
]);
export const staffCaseViews = new Set([
  "complaints",
  "complaint",
  "complaint-assigned",
  "complaint-evidence",
  "investigation",
  "resolve-complaint",
  "dismiss-complaint",
  "complaint-recorded",
  "reopen-complaint",
]);
