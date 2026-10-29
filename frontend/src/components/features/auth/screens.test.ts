import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./screens";
describe("authentication return links", () => {
  it("retains property paths, filters and anchors", () => {
    expect(safeReturnPath("/properties/example?city=Abuja#interest")).toBe(
      "/properties/example?city=Abuja#interest",
    );
  });
  it.each([
    null,
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\nevil.example",
    "javascript:alert(1)",
  ])("rejects unsafe target %s", (target) => {
    expect(safeReturnPath(target)).toBe("/properties");
  });
});
