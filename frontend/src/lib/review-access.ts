/** Temporary frontend review builds use sample records, never API credentials. */
export function isReviewAccessEnabled(value: string | undefined): boolean {
  return value === undefined || value === "true";
}
