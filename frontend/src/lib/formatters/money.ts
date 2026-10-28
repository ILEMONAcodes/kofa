// API_CONTRACT §2.10: all arithmetic uses integer kobo; this module only formats money.
function integer(amount: number): bigint {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new RangeError("Expected nonnegative safe integer kobo.");
  return BigInt(amount);
}
const commas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export function formatMoney(amount: number): string {
  const value = integer(amount);
  const kobo = value % 100n;
  return `₦${commas(String(value / 100n))}${kobo ? `.${String(kobo).padStart(2, "0")}` : ""}`;
}
export function formatMoneyCompact(amount: number): string {
  const value = integer(amount);
  for (const [unit, label] of [
    [100000000000n, "B"],
    [100000000n, "M"],
    [100000n, "K"],
  ] as const) {
    if (value >= unit) {
      const tenths = (value * 10n + unit / 2n) / unit;
      return `₦${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ""}${label}`;
    }
  }
  return formatMoney(amount);
}
export function moneyAccessibleLabel(amount: number): string {
  const value = integer(amount);
  const naira = value / 100n;
  const kobo = value % 100n;
  if (!naira && kobo) return `${kobo} kobo`;
  return `${commas(String(naira))} naira${kobo ? ` and ${kobo} kobo` : ""}`;
}
export class MoneyInputError extends Error {
  constructor(
    public readonly code: "max_decimals" | "invalid_format" | "out_of_range",
  ) {
    super(code);
  }
}
export function parseMoneyInput(text: string): number | null {
  const input = text.trim();
  if (!input) return null;
  if (/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{3,})$/.test(input))
    throw new MoneyInputError("max_decimals");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(input))
    throw new MoneyInputError("invalid_format");
  const [whole, fraction = ""] = input.replaceAll(",", "").split(".");
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new MoneyInputError("out_of_range");
  return Number(value);
}
