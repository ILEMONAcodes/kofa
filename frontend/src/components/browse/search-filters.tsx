import { Dropdown } from "@/components/common/dropdown";
import type { Taxonomy } from "@/types/filters";
// Presentational foundation only. Live taxonomy, URL state, Other preferences and budget steps belong to FE-4.11.
export function SearchFilters({ taxonomy }: { taxonomy?: Taxonomy }) {
  const cities = [...new Set(taxonomy?.areas.map((area) => area.city) ?? [])];
  return (
    <fieldset disabled={!taxonomy} className="rounded-xl border bg-surface p-5">
      <legend className="px-2 font-medium">Find your place</legend>
      <div className="grid gap-5 md:grid-cols-3">
        <Dropdown
          label="Location"
          options={[
            { value: "", label: "All locations" },
            ...cities.map((city) => ({ value: city, label: city })),
          ]}
        />
        <Dropdown
          label="Neighbourhood"
          options={[
            { value: "", label: "All neighbourhoods" },
            ...(taxonomy?.areas.map((area) => ({
              value: area.slug,
              label: area.neighbourhood,
            })) ?? []),
          ]}
        />
        <Dropdown
          label="Rent or buy"
          options={[
            { value: "", label: "Rent or buy" },
            ...(taxonomy?.listing_types.map((type) => ({
              value: type,
              label: type === "sale" ? "Buy" : "Rent",
            })) ?? []),
          ]}
        />
      </div>
      {!taxonomy && (
        <p className="mt-4 text-sm text-muted">
          Search options will be available when property search is connected.
        </p>
      )}
    </fieldset>
  );
}
