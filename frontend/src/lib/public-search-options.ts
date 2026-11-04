import type { Taxonomy } from "@/types/filters";
import { searchOptions, type SearchChoices } from "./property-search";
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
export function publicChoices(t: Taxonomy): SearchChoices {
  const pairs = (values: string[]): [string, string][] =>
    values.map((v) => [v, label(v)]);
  return {
    ...searchOptions,
    city: [
      ["", "All locations"],
      ...Array.from(new Set(t.areas.map((a) => a.city))).map(
        (v): [string, string] => [v, v],
      ),
      ["other", "Other"],
    ],
    area: [
      ["", "All neighbourhoods"],
      ...t.areas.map((a): [string, string] => [a.slug, a.neighbourhood]),
      ["other", "Other"],
    ],
    property_type: [
      ["", "Any type"],
      ...pairs(t.property_types),
      ["other", "Other"],
    ],
    furnishing: [["", "Any"], ...pairs(t.furnishing), ["other", "Other"]],
    amenities: [
      ["", "All amenities"],
      ...t.amenities.map((a): [string, string] => [a.code, a.label]),
      ["other", "Other"],
    ],
    availability: pairs(t.availability_statuses),
  };
}
