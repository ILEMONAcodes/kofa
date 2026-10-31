import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { actionButtonVariant } from "./action-presentation";
describe("product action hierarchy", () => {
  it("emphasizes record navigation and key browse actions", () => {
    for (const action of [
      "Open record →",
      "View details →",
      "Explore properties",
      "Start a general inquiry",
      "Review submission",
    ])
      expect(actionButtonVariant(action, "neutral")).toBe("primary");
  });
  it("preserves quiet secondary and subtle controls", () => {
    for (const action of ["Back", "Cancel", "Clear filters", "Remove photo"])
      expect(actionButtonVariant(action, "neutral")).toBe("secondary");
    expect(actionButtonVariant("Back", "subtle")).toBe("subtle");
    expect(actionButtonVariant("Send inquiry", "primary")).toBe("primary");
  });
  it("keeps implementation commentary out of customer-facing source copy", () => {
    const root = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../components/features",
    );
    function check(value: unknown): void {
      if (Array.isArray(value)) {
        value.forEach(check);
        return;
      }
      if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value)) {
          if (["text", "value"].includes(key) && typeof child === "string")
            expect(child).not.toMatch(
              /\b(mock|fictional|illustrative|prototype|backend)\b|design (preview|example|state)/i,
            );
          else if (typeof child === "object") check(child);
        }
    }
    for (const folder of [
      "client-journeys",
      "staff-operations",
      "administration",
      "media-help",
      "verification",
      "review-feedback",
      "responsive-reference",
    ])
      check(
        JSON.parse(readFileSync(resolve(root, folder, "screens.json"), "utf8")),
      );
  });
});
