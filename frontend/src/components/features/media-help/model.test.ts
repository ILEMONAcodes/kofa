import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import {
  destination,
  flatten,
  mediaScreens,
  outcome,
  policySlugs,
} from "./model";
describe("media and help presentation", () => {
  it("preserves all 39 source screens and exact local image slots", () => {
    expect(mediaScreens).toHaveLength(39);
    expect(new Set(mediaScreens.map((s) => s.slug)).size).toBe(39);
    for (const s of mediaScreens) {
      expect(s.id.startsWith("82:")).toBe(true);
      expect(s.blocks[1].text).toBeTruthy();
      for (const b of flatten(s.blocks).filter((b) => b.type === "image")) {
        expect(b.src?.startsWith("/assets/")).toBe(true);
        expect(existsSync(`public${b.src}`)).toBe(true);
        expect(statSync(`public${b.src}`).size).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
      }
    }
  });
  it("resolves every source action to a destination, local interaction or unavailable outcome", () => {
    const local =
      /^(Choose|Add evidence|Play walkthrough|Use as cover|Remove and return|Remove optional video|Secondary action|Call team)/;
    const check = (
      blocks: (typeof mediaScreens)[number]["blocks"],
      slug: string,
      context = "",
    ) => {
      for (const b of blocks) {
        if (b.type === "action")
          expect(
            Boolean(
              b.disabled ||
              destination(slug, b.text!, context) ||
              outcome(b.text!) ||
              local.test(b.text!),
            ),
            `${slug}: ${b.text}`,
          ).toBe(true);
        if (b.children) check(b.children, slug, b.name || context);
      }
    };
    mediaScreens.forEach((s) => check(s.blocks, s.slug));
  });
  it("contains six draft policy screens and loading placeholders", () => {
    expect(policySlugs).toHaveLength(6);
    expect(
      flatten(mediaScreens.find((s) => s.slug === "loading")!.blocks).filter(
        (b) => b.type === "skeleton",
      ),
    ).toHaveLength(6);
    for (const slug of policySlugs)
      expect(mediaScreens.some((s) => s.slug === slug)).toBe(true);
  });
  it("keeps service success and real actions distinct", () => {
    expect(destination("report", "Submit report")).toBeNull();
    expect(outcome("Submit report")).toBe("report-received");
    expect(destination("help", "View details →", "Privacy")).toBe("privacy");
    expect(destination("report-evidence", "Continue complaint")).toBe(
      "/account/complaint-form",
    );
  });
});
