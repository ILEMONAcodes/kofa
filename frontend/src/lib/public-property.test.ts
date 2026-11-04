import { describe, it, expect } from "vitest";
import { publicChoices } from "./public-search-options";
import { preferencesQuery, readPreferences } from "./property-search";
import {
  verificationLabel,
  availabilityLabel,
  publicCard,
} from "./public-property";
import type { Taxonomy } from "@/types/filters";
import type { PropertySummary } from "@/types/property";
const taxonomy: Taxonomy = {
  listing_types: ["rent", "sale"],
  property_types: ["apartment", "house"],
  furnishing: ["unfurnished"],
  availability_statuses: ["available", "under_offer"],
  areas: [
    {
      id: "a",
      slug: "life-camp",
      state: "FCT",
      city: "Abuja",
      neighbourhood: "Life Camp",
    },
  ],
  amenities: [{ code: "borehole", label: "Borehole", category: "water" }],
};
describe("live public property presentation", () => {
  it("round trips real taxonomy options instead of discarding non-sample slugs and codes", () => {
    const choices = publicChoices(taxonomy);
    const state = readPreferences(
      new URLSearchParams("area=life-camp&amenities=borehole"),
      choices,
    );
    const query = preferencesQuery(state, {}, choices);
    expect(query.get("area")).toBe("life-camp");
    expect(query.get("amenities")).toBe("borehole");
    expect(choices.area.some(([v]) => v === "jabi")).toBe(false);
  });
  it("uses actual verification dates and availability rather than sample labels", () => {
    expect(verificationLabel("2026-11-04T10:00:00Z")).toContain("4 Nov 2026");
    expect(verificationLabel(null)).toBe("Verification details");
    expect(availabilityLabel("under_offer")).toBe("Under offer");
  });
  it("shows a genuine placeholder for missing media without fabricating another property photo", () => {
    const property = {
      slug: "real-home",
      title: "Real home",
      cover_image: null,
      location: { neighbourhood: "Life Camp", city: "Abuja" },
    } as PropertySummary;
    expect(publicCard(property).image).toBe("/assets/property-placeholder.svg");
    expect(publicCard(property).location).toBe("Life Camp, Abuja");
  });
});
