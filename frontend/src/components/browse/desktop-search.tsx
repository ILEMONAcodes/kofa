"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/common/input";
import { Button } from "@/components/common/button";
import { PopoverSelect } from "@/components/common/popover-select";
import {
  searchOptions,
  defaultPreferences,
  preferencesQuery,
  readPreferences,
  type ChoiceKey,
} from "@/lib/property-search";
import { SearchBudget } from "./search-budget";
import { SearchResults } from "./search-results";
const labels: Record<ChoiceKey, string> = {
  city: "Location",
  area: "Neighbourhood",
  listing_type: "Rent or buy",
  property_type: "Property type",
  bedrooms: "Bedrooms",
  furnishing: "Furnishing",
  amenities: "Amenities",
  availability: "Availability",
  sort: "Sort by",
};
export function DesktopSearch({ query }: { query: string }) {
  const router = useRouter();
  const initial = readPreferences(new URLSearchParams(query));
  const [draft, setDraft] = useState(initial);
  const [other, setOther] = useState<Partial<Record<ChoiceKey, string>>>({});
  const [error, setError] = useState("");
  function apply(next = draft) {
    try {
      const params = preferencesQuery(next, other);
      setError("");
      router.push(`/properties?${params}`, { scroll: false });
    } catch (failure) {
      setError(
        failure instanceof Error &&
          !["invalid_format", "max_decimals", "out_of_range"].includes(
            failure.message,
          )
          ? failure.message
          : "Enter valid prices with up to two decimal places.",
      );
    }
  }
  function choice(key: ChoiceKey) {
    const hasOther = draft[key].split(",").includes("other");
    return (
      <div className="search-choice" key={key}>
        <PopoverSelect
          label={labels[key]}
          title={key === "city" ? "City" : labels[key]}
          description={
            key === "amenities"
              ? "Select all that apply"
              : searchOptions[key].some((o) => o[0] === "other")
                ? "Choose an option, or Other to specify."
                : "Choose an available option."
          }
          value={draft[key]}
          multiple={key === "amenities"}
          chevronAsset={
            key === "city" || key === "area"
              ? "/assets/search-chevron.svg"
              : undefined
          }
          options={searchOptions[key].map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => {
            const next = { ...draft, [key]: value };
            setDraft(next);
            if (key === "sort") apply(next);
          }}
        />
        {hasOther && (
          <Input
            label={`Specify ${labels[key].toLowerCase()} preference`}
            labelClassName="home-field-label"
            value={other[key] ?? ""}
            onChange={(event) =>
              setOther({ ...other, [key]: event.target.value })
            }
            hint="Used as a text-search preference; availability depends on listed properties."
          />
        )}
      </div>
    );
  }
  return (
    <>
      <section
        className="search-heading"
        data-node-id="15:176"
        aria-labelledby="search-heading"
      >
        <p className="text-home-caption text-primary">FIND YOUR PLACE</p>
        <h1 id="search-heading" className="text-home-section">
          Find your place in{" "}
          {initial.city === "Abuja" ? "Abuja" : "your preferred location"}.
        </h1>
        <p className="text-muted">
          6 sample results · {initial.listing_type === "sale" ? "Buy" : "Rent"}{" "}
          ·{" "}
          {searchOptions.availability.find(
            (o) => o[0] === initial.availability,
          )?.[1] ?? "Available"}
        </p>
      </section>
      <div className="search-workspace" data-node-id="15:180">
        <form
          className="search-sidebar"
          data-node-id="15:181"
          aria-label="Search preferences"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <h2 className="text-home-card">Refine your search</h2>
          {choice("city")}
          {choice("area")}
          {choice("listing_type")}
          <SearchBudget
            label="Minimum price"
            value={draft.price_min}
            onChange={(value) => setDraft({ ...draft, price_min: value })}
          />
          <SearchBudget
            label="Maximum price"
            value={draft.price_max}
            onChange={(value) => setDraft({ ...draft, price_max: value })}
          />
          {choice("property_type")}
          {choice("bedrooms")}
          {choice("furnishing")}
          {choice("amenities")}
          {choice("availability")}
          {draft.q && (
            <Input
              label="Text-search preference"
              value={draft.q}
              onChange={(event) =>
                setDraft({ ...draft, q: event.target.value })
              }
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit">Apply filters</Button>
          <Button
            variant="subtle"
            onClick={() => {
              setDraft({ ...defaultPreferences });
              setOther({});
              setError("");
              router.push("/properties", { scroll: false });
            }}
          >
            Clear filters
          </Button>
        </form>
        <section
          className="search-results"
          data-node-id="15:281"
          aria-label="Sample property results"
        >
          <div className="search-result-controls" data-node-id="15:282">
            <p className="font-medium">6 properties</p>
            {choice("sort")}
          </div>
          {query && (
            <p role="status" className="search-preview-note text-sm text-muted">
              Your preferences are saved in this URL. These six cards
              demonstrate the design; live filtered results will appear when
              property search is connected.
            </p>
          )}
          <SearchResults sort={initial.sort} />
        </section>
      </div>
    </>
  );
}
