import { describe, it, expect } from "vitest";
import { qualification, inquiryHref, terminal, unread } from "./model";
describe("inquiry presentation", () => {
  it("converts optional naira budgets to exact kobo", () =>
    expect(qualification("100,000.25", "200,000", "2026-12-01")).toEqual({
      budget_min: 10000025,
      budget_max: 20000000,
      desired_move_in: "2026-12-01",
    }));
  it("keeps omitted qualification empty", () =>
    expect(qualification("", "", "")).toEqual({
      budget_min: null,
      budget_max: null,
      desired_move_in: null,
    }));
  it("rejects reversed ranges and malformed money", () => {
    expect(() => qualification("200", "100", "")).toThrow();
    expect(() => qualification("bad", "", "")).toThrow();
  });
  it("links records and identifies terminal states", () => {
    expect(inquiryHref(false, "abc")).toBe("/account/conversation?id=abc");
    expect(terminal.has("spam")).toBe(true);
  });
  it("uses the server unread count", () => {
    expect(unread({ unread_count: 2 })).toBe(true);
    expect(unread({ unread_count: 0 })).toBe(false);
  });
});
