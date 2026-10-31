import { describe, it, expect } from "vitest";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  reviewScreens,
  reviewDestination,
  reviewOutcome,
  approvalPriceError,
} from "./model";
import { flatten } from "@/components/features/media-help/model";
describe("review and feedback references", () => {
  it("preserves six source states and exact local assets", () => {
    expect(reviewScreens).toHaveLength(6);
    expect(new Set(reviewScreens.map((s) => s.slug)).size).toBe(6);
    for (const s of reviewScreens) {
      expect(s.id.startsWith("117:")).toBe(true);
      for (const b of flatten(s.blocks).filter((b) => b.type === "image")) {
        const path = resolve(
          dirname(fileURLToPath(import.meta.url)),
          "../../../../public",
          `.${b.src}`,
        );
        expect(existsSync(path)).toBe(true);
        expect(statSync(path).size).toBeGreaterThan(0);
      }
    }
  });
  it("routes source actions without making operational transitions", () => {
    for (const s of reviewScreens)
      for (const b of flatten(s.blocks).filter((b) => b.type === "action"))
        expect(
          Boolean(reviewDestination(s.slug, b.text!) || reviewOutcome(b.text!)),
          b.text,
        ).toBe(true);
    expect(
      reviewDestination("publication-review", "Publish property"),
    ).toBeNull();
    expect(reviewOutcome("Publish property")).toBe("published");
  });
  it("retains distinct pending and passed checks, and description approval", () => {
    expect(
      flatten(reviewScreens[0].blocks).find((b) => b.label === "Features")
        ?.value,
    ).toBe("Pending ▾");
    expect(
      flatten(reviewScreens[2].blocks).find((b) => b.label === "Features")
        ?.value,
    ).toBe("Pass ▾");
    expect(
      flatten(reviewScreens[3].blocks).find((b) => b.type === "consent")?.label,
    ).toBe("The current advertised description was approved.");
  });
  it("validates price presentation with the shared integer money parser", () => {
    expect(approvalPriceError("₦3,500,000")).toBeNull();
    expect(approvalPriceError("3500000.50")).toBeNull();
    for (const value of [
      "",
      "0",
      "-1",
      "abc",
      "12.345",
      "1,00",
      "900719925474099100",
    ])
      expect(approvalPriceError(value)).toBeTruthy();
  });
});
