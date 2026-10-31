import { describe, expect, it } from "vitest";
import { isReviewAccessEnabled } from "./review-access";
describe("frontend review build access", () => {
  it("works on hosted builds without a private local flag", () =>
    expect(isReviewAccessEnabled(undefined)).toBe(true));
  it("supports explicitly enabling review access", () =>
    expect(isReviewAccessEnabled("true")).toBe(true));
  it.each(["false", "", "FALSE", "invalid"])(
    "does not enable access for explicit value %s",
    (value) => expect(isReviewAccessEnabled(value)).toBe(false),
  );
});
