import { describe, it, expect } from "vitest";
import { staffLink, errorText, priceText } from "./model";
import { ApiError } from "@/lib/api/error";
describe("live staff navigation and errors", () => {
  it("retains the selected property and safely encodes its identifier", () =>
    expect(staffLink("media", "a&b")).toBe("/staff/media?id=a%26b"));
  it("makes stale writes recoverable without claiming success", () =>
    expect(errorText(new ApiError(409, "CONFLICT", "stale"))).toContain(
      "Reload",
    ));
  it("does not round amounts outside safe integer precision", () =>
    expect(priceText(Number.MAX_SAFE_INTEGER + 1)).toBe("Price needs review"));
});
