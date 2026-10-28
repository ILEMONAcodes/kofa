import { describe, expect, it } from "vitest";
import {
  safePropertiesReturn,
  propertyDetailHref,
} from "./property-navigation";
import { previewDetail } from "@/components/browse/detail-content";
describe("property detail navigation", () => {
  it("retains search constraints and verification anchors", () => {
    const back = "/properties?city=Abuja&price_max=500000000&sort=price";
    const url = new URL(
      propertyDetailHref("3-bedroom-flat-wuse-2", back, "verification"),
      "https://example.test",
    );
    expect(url.pathname).toBe("/properties/3-bedroom-flat-wuse-2");
    expect(url.searchParams.get("returnTo")).toBe(back);
    expect(url.hash).toBe("#verification");
  });
  it("rejects external and unrelated return destinations", () => {
    for (const input of [
      "https://evil.example/properties",
      "//evil.example/properties",
      "/properties/../admin",
      "/properties\\@evil.example",
      "/login",
      "javascript:alert(1)",
      "/properties\n?x=1",
    ])
      expect(safePropertiesReturn(input)).toBe("/properties");
  });
  it("resolves known previews but never makes up charges or unknown properties", () => {
    expect(previewDetail("3-bedroom-flat-wuse-2")?.cautionFee).toBe(35000000);
    expect(previewDetail("4-bedroom-duplex-gwarinpa")?.cautionFee).toBeNull();
    expect(previewDetail("unknown-slug")).toBeUndefined();
  });
});
