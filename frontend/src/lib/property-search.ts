import { formatMoney, parseMoneyInput } from "./formatters/money";
export const searchOptions = {
  city: [
    ["Abuja", "Abuja"],
    ["other", "Other"],
  ],
  area: [
    ["", "All neighbourhoods"],
    ["wuse-2", "Wuse 2"],
    ["jabi", "Jabi"],
    ["gwarinpa", "Gwarinpa"],
    ["other", "Other"],
  ],
  listing_type: [
    ["rent", "Rent"],
    ["sale", "Buy"],
  ],
  property_type: [
    ["", "Any type"],
    ["apartment", "Apartment"],
    ["house", "House"],
    ["duplex", "Duplex"],
    ["bungalow", "Bungalow"],
    ["terrace", "Terrace"],
    ["studio", "Studio"],
    ["room", "Room"],
    ["other", "Other"],
  ],
  bedrooms: [
    ["", "Any"],
    ["0", "Studio / 0 bedrooms"],
    ["1", "1 bedroom"],
    ["2", "2 bedrooms"],
    ["3", "3 bedrooms"],
    ["4", "4 bedrooms"],
    ["5", "5 bedrooms"],
    ["6", "6+ bedrooms"],
    ["other", "Other"],
  ],
  furnishing: [
    ["", "Any"],
    ["furnished", "Furnished"],
    ["semi_furnished", "Semi-furnished"],
    ["unfurnished", "Unfurnished"],
    ["other", "Other"],
  ],
  amenities: [
    ["", "All amenities"],
    ["parking", "Parking"],
    ["water_supply", "Water supply"],
    ["generator", "Generator"],
    ["security", "Security"],
    ["fitted_kitchen", "Fitted kitchen"],
    ["other", "Other"],
  ],
  availability: [
    ["available", "Available"],
    ["under_offer", "Under offer"],
    ["unavailable", "Unavailable"],
  ],
  sort: [
    ["-published_at", "Newest listings"],
    ["price", "Price: low to high"],
    ["-price", "Price: high to low"],
    ["-verified_at", "Recently verified"],
  ],
} as const;
export type ChoiceKey = keyof typeof searchOptions;
export interface SearchPreferences {
  city: string;
  area: string;
  listing_type: string;
  property_type: string;
  bedrooms: string;
  furnishing: string;
  amenities: string;
  availability: string;
  sort: string;
  price_min: string;
  price_max: string;
  q: string;
}
export const defaultPreferences: SearchPreferences = {
  city: "Abuja",
  area: "",
  listing_type: "rent",
  property_type: "apartment",
  bedrooms: "",
  furnishing: "",
  amenities: "",
  availability: "available",
  sort: "-published_at",
  price_min: "1,000,000",
  price_max: "6,000,000",
  q: "",
};
export function readPreferences(params: URLSearchParams): SearchPreferences {
  const state = { ...defaultPreferences };
  // A homepage handoff supplies only its chosen constraints, not sidebar defaults.
  if (params.size) {
    if (!params.has("city")) state.city = "";
    state.property_type = "";
    state.price_min = "";
    state.price_max = "";
  }
  for (const key of Object.keys(searchOptions) as ChoiceKey[]) {
    if (key === "bedrooms") continue;
    const raw = params.get(key);
    if (
      raw !== null &&
      raw
        .split(",")
        .every((v) =>
          searchOptions[key].some((o) => o[0] === v && v !== "other"),
        )
    )
      state[key] = raw;
  }
  for (const key of ["price_min", "price_max"] as const) {
    const value = params.get(key);
    if (
      value !== null &&
      /^\d+$/.test(value) &&
      Number.isSafeInteger(Number(value))
    )
      state[key] = formatMoney(Number(value)).slice(1);
  }
  const bedrooms = params.get("bedrooms_min");
  if (bedrooms !== null && /^[0-6]$/.test(bedrooms)) state.bedrooms = bedrooms;
  state.q = params.get("q") ?? "";
  return state;
}
export function preferencesQuery(
  state: SearchPreferences,
  other: Partial<Record<ChoiceKey, string>> = {},
): URLSearchParams {
  const params = new URLSearchParams();
  const terms = [state.q.trim()];
  for (const key of Object.keys(searchOptions) as ChoiceKey[]) {
    if (key === "bedrooms") continue;
    const values = state[key].split(",").filter(Boolean);
    const supported = values.filter(
      (value) =>
        value !== "other" &&
        searchOptions[key].some((option) => option[0] === value),
    );
    if (supported.length) params.set(key, supported.join(","));
    if (values.includes("other")) {
      if (!other[key]?.trim())
        throw new Error(
          "Specify each Other preference before applying filters.",
        );
      terms.push(other[key]!.trim());
    }
  }
  if (state.bedrooms === "other") {
    if (!other.bedrooms?.trim())
      throw new Error("Specify your bedroom preference.");
    terms.push(other.bedrooms.trim());
  } else if (state.bedrooms) {
    params.set("bedrooms_min", state.bedrooms);
    if (state.bedrooms !== "6") params.set("bedrooms_max", state.bedrooms);
  }
  const min = parseMoneyInput(state.price_min),
    max = parseMoneyInput(state.price_max);
  if (min !== null && max !== null && min > max)
    throw new Error("Minimum price must not exceed maximum price.");
  if (min !== null) params.set("price_min", String(min));
  if (max !== null) params.set("price_max", String(max));
  if (terms.filter(Boolean).length)
    params.set("q", terms.filter(Boolean).join(" "));
  return params;
}
