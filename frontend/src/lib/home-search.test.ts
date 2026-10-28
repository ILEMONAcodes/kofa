import { describe, it, expect } from "vitest";
import { homeSearchHref } from "./home-search";
describe("homepage search handoff", () => {
  it("serializes rent and integer kobo budget", () => {
    const url = new URL(
      homeSearchHref({
        city: "Abuja",
        other: "",
        listingType: "rent",
        budget: 500000000,
      }),
      "http://localhost",
    );
    expect(url.searchParams.get("city")).toBe("Abuja");
    expect(url.searchParams.get("price_max")).toBe("500000000");
    expect(url.searchParams.get("listing_type")).toBe("rent");
  });
  it("uses the contract sale enum for Buy", () =>
    expect(
      homeSearchHref({
        city: "Abuja",
        other: "",
        listingType: "sale",
        budget: null,
      }),
    ).toBe("/properties?listing_type=sale&city=Abuja"));
  it("encodes Other as supported text search rather than a taxonomy enum", () => {
    const url = new URL(
      homeSearchHref({
        city: "other",
        other: "  Ground floor & garden ",
        listingType: "rent",
        budget: 0,
      }),
      "http://localhost",
    );
    expect(url.searchParams.get("q")).toBe("Ground floor & garden");
    expect(url.searchParams.has("city")).toBe(false);
    expect(url.searchParams.get("price_max")).toBe("0");
  });
});
