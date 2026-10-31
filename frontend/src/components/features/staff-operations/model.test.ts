import { describe, it, expect } from "vitest";
import {
  mediaError,
  previewDestination,
  exampleOutcome,
  staffScreens,
  visibleRecordText,
} from "./model";
describe("staff preview media validation", () => {
  it("accepts source format/size boundaries", () => {
    expect(
      mediaError(
        Array.from({ length: 20 }, () => ({
          type: "image/webp",
          size: 10 * 1024 * 1024,
        })),
        "photo",
      ),
    ).toBeUndefined();
    expect(
      mediaError([{ type: "video/webm", size: 100 * 1024 * 1024 }], "video"),
    ).toBeUndefined();
  });
  it("rejects unsupported files and excess size/count", () => {
    expect(
      mediaError([{ type: "application/pdf", size: 10 }], "photo"),
    ).toMatch(/JPEG/);
    expect(
      mediaError([{ type: "image/png", size: 10 * 1024 * 1024 + 1 }], "photo"),
    ).toMatch(/10 MB/);
    expect(
      mediaError(
        Array.from({ length: 21 }, () => ({ type: "image/jpeg", size: 10 })),
        "photo",
      ),
    ).toMatch(/20/);
    expect(
      mediaError([{ type: "video/mp4", size: 100 * 1024 * 1024 + 1 }], "video"),
    ).toMatch(/100 MB/);
    expect(
      mediaError(
        [
          { type: "video/mp4", size: 1 },
          { type: "video/webm", size: 1 },
        ],
        "video",
      ),
    ).toMatch(/one video/);
  });
});
it("keeps inspection and landlord records in their own journeys", () => {
  expect(previewDestination("inspections", "Open record →", "APT-000123")).toBe(
    "inspection",
  );
  expect(previewDestination("landlords", "Open record →", "Property owner")).toBe(
    "landlord",
  );
  expect(previewDestination("client", "Open record →", "Inspection")).toBe(
    "inspection",
  );
  expect(
    previewDestination("inquiry", "Send client reply", "Actions"),
  ).toBeNull();
  expect(exampleOutcome("inquiry", "Send client reply")).toBe("reply-recorded");
});
it("has unique field identities across all 37 source screens", () => {
  expect(staffScreens).toHaveLength(37);
  for (const screen of staffScreens) {
    const ids: string[] = [];
    const walk = (blocks: typeof screen.blocks) =>
      blocks.forEach((block) => {
        ids.push(block.id);
        if (block.children) walk(block.children);
      });
    walk(screen.blocks);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  }
});

it("searches visible record content rather than hidden source metadata", () => {
  const card = staffScreens
    .find((screen) => screen.slug === "properties")!
    .blocks.find((block) => block.name === "3-bedroom flat · Wuse 2")!;
  expect(visibleRecordText(card)).toContain("Wuse 2");
  expect(visibleRecordText(card)).not.toContain(card.id);
  expect(visibleRecordText(card)).not.toContain("group");
});
