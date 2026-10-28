import { describe, expect, it } from "vitest";
import {
  formatMoney,
  formatMoneyCompact,
  moneyAccessibleLabel,
  parseMoneyInput,
} from "./money";
describe("contract §2.10 display vectors", () => {
  it.each([
    [0, "₦0", "₦0", "0 naira"],
    [99, "₦0.99", "₦0.99", "99 kobo"],
    [85000000, "₦850,000", "₦850K", "850,000 naira"],
    [150000000, "₦1,500,000", "₦1.5M", "1,500,000 naira"],
    [150000050, "₦1,500,000.50", "₦1.5M", "1,500,000 naira and 50 kobo"],
    [5000000000, "₦50,000,000", "₦50M", "50,000,000 naira"],
  ])("formats %i kobo", (amount, full, compact, label) => {
    expect(formatMoney(amount)).toBe(full);
    expect(formatMoneyCompact(amount)).toBe(compact);
    expect(moneyAccessibleLabel(amount)).toBe(label);
  });
  it.each([
    ["1,500,000.50", 150000050],
    ["850000", 85000000],
    ["0.5", 50],
    ["", null],
  ])("parses %s", (input, value) => expect(parseMoneyInput(input)).toBe(value));
  it.each([
    ["12.345", "max_decimals"],
    ["1.5M", "invalid_format"],
    ["1,50", "invalid_format"],
    ["-1", "invalid_format"],
    ["99999999999999999", "out_of_range"],
  ])("rejects %s", (input, code) => {
    expect(() => parseMoneyInput(input)).toThrow(code);
  });
  it.each([-1, 0.1, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid kobo %s",
    (amount) => expect(() => formatMoney(amount)).toThrow(),
  );
});
