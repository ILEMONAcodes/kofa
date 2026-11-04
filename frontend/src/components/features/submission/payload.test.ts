import { describe, it, expect } from "vitest";
import { sampleDraft } from "./model";
import { submissionPayload } from "./payload";
import type { Taxonomy } from "@/types/filters";
const taxonomy: Taxonomy = {
  listing_types: ["rent", "sale"],
  property_types: ["apartment", "house"],
  furnishing: ["furnished", "unfurnished"],
  availability_statuses: ["available", "under_offer", "unavailable"],
  areas: [
    {
      id: "real-area-id",
      slug: "wuse-2",
      neighbourhood: "Wuse 2",
      city: "Abuja",
      state: "FCT",
    },
  ],
  amenities: [
    { code: "parking", label: "Parking", category: "parking" },
    { code: "generator", label: "Generator", category: "power" },
    { code: "fitted_kitchen", label: "Fitted kitchen", category: "facilities" },
  ],
};
const policies = {
  approved: true,
  policies: [
    { type: "terms" as const, version: "actual-v2", url: "/resources/terms" },
    {
      type: "privacy" as const,
      version: "actual-v3",
      url: "/resources/privacy",
    },
  ],
};
describe("landlord submission payload", () => {
  it("uses real area IDs, integer kobo, current policy versions and normalized amenity codes", () => {
    const body = submissionPayload(sampleDraft, taxonomy, policies);
    expect(body.property.area_id).toBe("real-area-id");
    expect(body.property.price).toEqual({
      amount: 350000000,
      currency: "NGN",
      period: "year",
    });
    expect(body.property.amenity_codes).toEqual([
      "parking",
      "generator",
      "fitted_kitchen",
    ]);
    expect(body.accepted_policies.map((p) => p.version)).toEqual([
      "actual-v2",
      "actual-v3",
    ]);
    expect(body.landlord.relationship).toBe("owner");
    expect(body).not.toHaveProperty("role");
  });
  it("uses one_time for sale without losing exact prices and optional empty email", () => {
    const b = submissionPayload(
      {
        ...sampleDraft,
        listing_type: "sale",
        email: "",
        price: "10,000,000.01",
      },
      taxonomy,
      policies,
    );
    expect(b.property.price).toEqual({
      amount: 1000000001,
      currency: "NGN",
      period: "one_time",
    });
    expect(b.landlord.email).toBeNull();
  });
  it("keeps Other amenities as private conditions instead of inventing taxonomy codes", () => {
    const b = submissionPayload(
      {
        ...sampleDraft,
        amenities: "parking,other",
        amenitiesOther: "Roof garden",
        conditions: "No pets",
      },
      taxonomy,
      policies,
    );
    expect(b.property.amenity_codes).toEqual(["parking"]);
    expect(b.property.landlord_conditions).toBe(
      "No pets\nOther amenities: Roof garden",
    );
  });
  it("rejects unsupported structural choices, missing areas and too-long conditions before creating a draft", () => {
    expect(() =>
      submissionPayload(
        { ...sampleDraft, area: "Unknown" },
        taxonomy,
        policies,
      ),
    ).toThrow("available listing areas");
    expect(() =>
      submissionPayload(
        {
          ...sampleDraft,
          property_type: "other",
          property_typeOther: "castle",
        },
        taxonomy,
        policies,
      ),
    ).toThrow("available property type");
    expect(() =>
      submissionPayload(
        { ...sampleDraft, conditions: "a".repeat(2001) },
        taxonomy,
        policies,
      ),
    ).toThrow("2,000");
  });
  it("does not allow incomplete charges or invalid room counts", () => {
    expect(() =>
      submissionPayload({ ...sampleDraft, charge: "" }, taxonomy, policies),
    ).toThrow("both");
    expect(() =>
      submissionPayload(
        { ...sampleDraft, bedrooms: "other", bedroomsOther: "many" },
        taxonomy,
        policies,
      ),
    ).toThrow("whole number");
  });
});
