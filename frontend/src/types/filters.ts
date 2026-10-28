import type {
  Availability,
  Furnishing,
  ListingType,
  PropertyType,
} from "./property";
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface Taxonomy {
  listing_types: ListingType[];
  property_types: PropertyType[];
  furnishing: Furnishing[];
  availability_statuses: Availability[];
  amenities: { code: string; label: string; category: string }[];
  areas: {
    id: string;
    state: string;
    city: string;
    neighbourhood: string;
    slug: string;
  }[];
}
export type PropertySort =
  | "published_at"
  | "-published_at"
  | "price"
  | "-price"
  | "verified_at"
  | "-verified_at";
// Array values serialize comma-separated; price bounds are integer kobo.
export interface PropertyFilters {
  q?: string;
  listing_type?: ListingType;
  property_type?: PropertyType[];
  state?: string;
  city?: string;
  area?: string[];
  price_min?: number;
  price_max?: number;
  bedrooms_min?: number;
  bedrooms_max?: number;
  furnishing?: Furnishing[];
  amenities?: string[];
  availability?: Availability[];
  sort?: PropertySort;
  page?: number;
  page_size?: number;
}
// bathrooms_min stays a valid API field but is intentionally omitted from UI filters (2026-10-28).
export interface PropertyApiFilters extends PropertyFilters {
  bathrooms_min?: number;
}
