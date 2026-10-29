import { describe, it, expect } from "vitest";
import { fileProblem, stepProblem, sampleDraft, emptyDraft } from "./model";
describe("listing presentation validation", () => {
  it("accepts complete sample data without changing it", () => {
    for (const step of [
      "contact",
      "property",
      "pricing",
      "features",
      "uploads",
    ] as const)
      expect(stepProblem(step, sampleDraft, 5, 1)).toBeNull();
  });
  it("requires contact details but permits optional email", () => {
    expect(stepProblem("contact", emptyDraft, 0, 0)).not.toBeNull();
    expect(
      stepProblem("contact", { ...sampleDraft, email: "" }, 0, 0),
    ).toBeNull();
    expect(
      stepProblem("contact", { ...sampleDraft, phone: "123" }, 0, 0),
    ).not.toBeNull();
  });
  it("validates property description limits", () =>
    expect(
      stepProblem(
        "property",
        { ...sampleDraft, description: "Too short" },
        0,
        0,
      ),
    ).not.toBeNull());
  it.each(["999", "2.123", "garbage", "9007199254740999"])(
    "rejects invalid price %s",
    (price) =>
      expect(
        stepProblem("pricing", { ...sampleDraft, price }, 0, 0),
      ).not.toBeNull(),
  );
  it("requires labels and amounts together", () => {
    expect(
      stepProblem("pricing", { ...sampleDraft, charge: "" }, 0, 0),
    ).not.toBeNull();
    expect(
      stepProblem("pricing", { ...sampleDraft, charge_label: "" }, 0, 0),
    ).not.toBeNull();
  });
  it("requires actual bathroom count and Other descriptions", () => {
    expect(
      stepProblem("features", { ...sampleDraft, bathrooms: "21" }, 0, 0),
    ).not.toBeNull();
    expect(
      stepProblem(
        "features",
        { ...sampleDraft, furnishing: "other", furnishingOther: "" },
        0,
        0,
      ),
    ).not.toBeNull();
    expect(
      stepProblem(
        "features",
        { ...sampleDraft, amenities: "Parking,other" },
        0,
        0,
      ),
    ).not.toBeNull();
  });
  it("requires five photos and evidence while video is optional", () => {
    expect(stepProblem("uploads", sampleDraft, 4, 1)).not.toBeNull();
    expect(stepProblem("uploads", sampleDraft, 5, 0)).not.toBeNull();
    expect(stepProblem("uploads", sampleDraft, 5, 1)).toBeNull();
  });
});
describe("local file selection limits", () => {
  it("accepts permitted file metadata", () => {
    expect(
      fileProblem("photo", { type: "image/webp", size: 10 * 1024 * 1024 }, 19),
    ).toBeNull();
    expect(
      fileProblem("document", { type: "application/pdf", size: 2 }, 0),
    ).toBeNull();
    expect(
      fileProblem("video", { type: "video/webm", size: 100 * 1024 * 1024 }, 0),
    ).toBeNull();
  });
  it("rejects unsupported, empty, oversized and excess files", () => {
    expect(
      fileProblem("photo", { type: "image/svg+xml", size: 20 }, 0),
    ).not.toBeNull();
    expect(
      fileProblem("document", { type: "application/pdf", size: 0 }, 0),
    ).not.toBeNull();
    expect(
      fileProblem(
        "video",
        { type: "video/mp4", size: 100 * 1024 * 1024 + 1 },
        0,
      ),
    ).not.toBeNull();
    expect(
      fileProblem("photo", { type: "image/jpeg", size: 1 }, 20),
    ).not.toBeNull();
    expect(
      fileProblem("document", { type: "application/pdf", size: 1 }, 10),
    ).not.toBeNull();
  });
});
