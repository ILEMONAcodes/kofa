import type { PropertySummary } from "@/types/property";
import type { HomeListing } from "@/components/browse/home-content";
import { formatStaffDate } from "./formatters/date";
export function publicCard(p: PropertySummary): HomeListing {
  return {
    ...p,
    image: p.cover_image?.url ?? "/assets/property-placeholder.svg",
    alt: p.cover_image?.alt ?? `${p.title} property photo`,
    location: `${p.location.neighbourhood}, ${p.location.city}`,
  };
}
export const verificationLabel = (date?: string | null) =>
  date
    ? `Verified on ${formatStaffDate(date, "date")}`
    : "Verification details";
export const availabilityLabel = (value?: string) =>
  value === "under_offer"
    ? "Under offer"
    : value === "unavailable"
      ? "Unavailable"
      : "Available";
