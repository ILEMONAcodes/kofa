import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  preferencesQuery,
  readPreferences,
} from "./property-search";
describe("desktop search URL preferences", () => {
  it("hydrates the homepage budget without adding sidebar constraints", () => {
    const state = readPreferences(
      new URLSearchParams("listing_type=rent&city=Abuja&price_max=500000000"),
    );
    expect(state.price_max).toBe("5,000,000");
    expect(state.price_min).toBe("");
    expect(state.property_type).toBe("");
  });
  it("serializes exact bedrooms, multiselect and prices in integer kobo", () => {
    const params = preferencesQuery({
      ...defaultPreferences,
      bedrooms: "2",
      amenities: "parking,generator",
      price_min: "100,000.01",
    });
    expect(params.get("bedrooms_min")).toBe("2");
    expect(params.get("bedrooms_max")).toBe("2");
    expect(params.get("amenities")).toBe("parking,generator");
    expect(params.get("price_min")).toBe("10000001");
    expect(params.has("bathrooms_min")).toBe(false);
    expect(readPreferences(params).amenities).toBe("parking,generator");
  });
  it("keeps 6+ open-ended and Other as text rather than taxonomy", () => {
    const params = preferencesQuery(
      { ...defaultPreferences, bedrooms: "6", area: "other", q: "quiet" },
      { area: "near a park" },
    );
    expect(params.has("bedrooms_max")).toBe(false);
    expect(params.has("area")).toBe(false);
    expect(params.get("q")).toBe("quiet near a park");
  });
  it("rejects missing Other, inverted prices and unsafe money", () => {
    expect(() =>
      preferencesQuery({ ...defaultPreferences, city: "other" }),
    ).toThrow("Specify");
    expect(() =>
      preferencesQuery({ ...defaultPreferences, price_min: "7,000,000" }),
    ).toThrow("Minimum");
    expect(() =>
      preferencesQuery({ ...defaultPreferences, price_max: "1.001" }),
    ).toThrow();
    expect(() =>
      preferencesQuery({
        ...defaultPreferences,
        price_max: "999999999999999999",
      }),
    ).toThrow();
  });
  it("does not constrain an Other-location handoff to Abuja", () => {
    const state = readPreferences(
      new URLSearchParams("listing_type=rent&q=Lagos"),
    );
    expect(state.city).toBe("");
    expect(preferencesQuery(state).has("city")).toBe(false);
    expect(state.q).toBe("Lagos");
  });
  it("ignores unknown taxonomy and unsafe query amounts", () => {
    const state = readPreferences(
      new URLSearchParams(
        "listing_type=invalid&price_max=999999999999999999&area=unknown&sort=secret",
      ),
    );
    expect(state.listing_type).toBe("rent");
    expect(state.price_max).toBe("");
    expect(state.area).toBe("");
    expect(state.sort).toBe("-published_at");
  });
});
