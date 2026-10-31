import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { illustrativeListings } from "@/components/browse/home-content";
import { previewDetail } from "@/components/browse/detail-content";
import {
  listingPrice,
  pricePeriodLabel,
  furnishingLabel,
} from "./property-presentation";
const publicDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../public",
);
describe("illustrative property catalogue", () => {
  it("has twelve unique records and twelve distinct local cover photographs", () => {
    expect(illustrativeListings).toHaveLength(12);
    expect(new Set(illustrativeListings.map((p) => p.slug)).size).toBe(12);
    const hashes = illustrativeListings.map((p) => {
      const file = resolve(publicDir, `.${p.image}`);
      expect(existsSync(file)).toBe(true);
      expect(p.alt).toMatch(/illustrative/i);
      expect(Number.isSafeInteger(p.price.amount)).toBe(true);
      expect(previewDetail(p.slug)?.photos[0].src).toBe(p.image);
      return createHash("sha256").update(readFileSync(file)).digest("hex");
    });
    expect(new Set(hashes).size).toBe(12);
    expect(new Set(illustrativeListings.map((p) => p.property_type)).size).toBe(
      7,
    );
    expect(new Set(illustrativeListings.map((p) => p.listing_type))).toEqual(
      new Set(["rent", "sale"]),
    );
  });
  it("new sample detail galleries never borrow unrelated property photographs", () => {
    for (const p of illustrativeListings.slice(3)) {
      expect(previewDetail(p.slug)?.photos).toHaveLength(1);
      expect(previewDetail(p.slug)?.photos[0].label).toBe("Sample cover photo");
    }
    expect(previewDetail(illustrativeListings[0].slug)?.photos).toHaveLength(3);
  });
  it("formats rent periods, one-time sale prices and all furnishing variants", () => {
    expect(
      listingPrice({ amount: 350000000, currency: "NGN", period: "year" }),
    ).toBe("₦3,500,000 /year");
    expect(
      listingPrice({ amount: 15000000, currency: "NGN", period: "month" }),
    ).toBe("₦150,000 /month");
    const price = {
      amount: 18000000000,
      currency: "NGN" as const,
      period: "one_time" as const,
    };
    expect(listingPrice(price)).toBe("₦180,000,000");
    expect(pricePeriodLabel(price)).toBe("For sale");
    expect(furnishingLabel.semi_furnished).toBe("Semi-furnished");
  });
});
