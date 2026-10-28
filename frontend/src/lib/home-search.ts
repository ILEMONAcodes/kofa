import type { ListingType } from "@/types/property";
export function homeSearchHref({
  city,
  other,
  listingType,
  budget,
}: {
  city: string;
  other: string;
  listingType: ListingType;
  budget: number | null;
}) {
  const params = new URLSearchParams({ listing_type: listingType });
  if (city === "other") {
    if (other.trim()) params.set("q", other.trim());
  } else params.set("city", city);
  if (budget !== null) params.set("price_max", String(budget));
  return `/properties?${params.toString()}`;
}
