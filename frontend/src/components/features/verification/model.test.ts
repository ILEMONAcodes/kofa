import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  verificationScreens,
  verificationDestination,
  verificationOutcome,
  isVerificationWorkspace,
} from "./model";
import { flatten } from "@/components/features/media-help/model";
describe("verification presentation", () => {
  it("contains eight source states and exact local assets", () => {
    expect(verificationScreens).toHaveLength(8);
    expect(new Set(verificationScreens.map((s) => s.slug)).size).toBe(8);
    for (const s of verificationScreens) {
      expect(s.id.startsWith("91:")).toBe(true);
      for (const b of flatten(s.blocks).filter((b) => b.type === "image"))
        expect(
          existsSync(
            resolve(
              dirname(fileURLToPath(import.meta.url)),
              "../../../../public",
              `.${b.src}`,
            ),
          ),
        ).toBe(true);
    }
  });
  it("connects all source actions without making real transitions", () => {
    for (const s of verificationScreens)
      for (const b of flatten(s.blocks).filter((b) => b.type === "action"))
        expect(
          Boolean(
            verificationDestination(s.slug, b.text!) ||
            verificationOutcome(b.text!),
          ),
          b.text,
        ).toBe(true);
    expect(verificationDestination("publish", "Publish listing")).toBeNull();
    expect(verificationOutcome("Publish listing")).toBe("published");
  });
  it("distinguishes staff and client navigation", () => {
    expect(
      verificationScreens.filter((s) => isVerificationWorkspace(s.slug)),
    ).toHaveLength(6);
    expect(isVerificationWorkspace("agreement")).toBe(false);
    expect(isVerificationWorkspace("completed")).toBe(false);
  });
  it("keeps the source client fee quote unchanged with no calculations", () => {
    const text = flatten(
      verificationScreens.find((s) => s.slug === "agreement")!.blocks,
    )
      .map((b) => b.text ?? "")
      .join("\n");
    expect(text).toContain("Amount: ₦70,000");
    expect(text).toContain("Conditions: 2% of annual rent");
    expect(text).toContain("No client payment recorded.");
  });
});
