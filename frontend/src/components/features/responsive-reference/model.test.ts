import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { responsiveScreens, responsiveDestination } from "./model";
import { flatten } from "../media-help/model";
describe("360 px source references", () => {
  it("preserves seven source frames with existing local assets and budget inputs", () => {
    expect(responsiveScreens).toHaveLength(7);
    for (const s of responsiveScreens) {
      expect(s.id.startsWith("94:")).toBe(true);
      expect(s.blocks[1].text).toBeTruthy();
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
    expect(
      flatten(responsiveScreens[0].blocks).filter((b) => b.type === "budget"),
    ).toHaveLength(2);
  });
  it("keeps mutations unavailable and uses existing review flows", () => {
    expect(responsiveDestination("inquiry", "Send inquiry", "")).toBeNull();
    expect(
      responsiveDestination("investigation", "Save working record", ""),
    ).toBeNull();
    expect(
      responsiveDestination(
        "overview",
        "View details →",
        "Follow up inquiries",
      ),
    ).toBe("inquiries");
  });
});
