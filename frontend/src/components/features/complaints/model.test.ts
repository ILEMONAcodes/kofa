import { describe, it, expect } from "vitest";
import { evidenceError, caseLink } from "./model";
describe("complaint evidence selections", () => {
  it("allows supported files within limits", () =>
    expect(
      evidenceError([new File(["proof"], "proof.png", { type: "image/png" })]),
    ).toBe(""));
  it("rejects more than three files", () =>
    expect(
      evidenceError(
        Array.from(
          { length: 4 },
          () => new File(["x"], "e.pdf", { type: "application/pdf" }),
        ),
      ),
    ).toContain("three"));
  it("rejects an oversized file", () =>
    expect(
      evidenceError([
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf", {
          type: "application/pdf",
        }),
      ]),
    ).toContain("5 MB"));
  it("rejects unsupported files", () =>
    expect(
      evidenceError([new File(["x"], "e.html", { type: "text/html" })]),
    ).toContain("JPEG"));
  it("links actual record identifiers", () => {
    expect(caseLink(false, "a/b")).toBe("/account/complaint-detail?id=a%2Fb");
    expect(caseLink(true, "case")).toBe("/staff/complaint?id=case");
  });
});
