import type { Money, PropertyPrice } from "./api";
export type ListingType = "rent" | "sale";
export type PropertyType =
  | "apartment"
  | "house"
  | "duplex"
  | "bungalow"
  | "terrace"
  | "studio"
  | "room";
export type Furnishing = "furnished" | "semi_furnished" | "unfurnished";
export type Availability = "available" | "under_offer" | "unavailable";
export interface PropertyImage {
  url: string;
  thumb_url: string | null;
  alt: string | null;
}
// Public schema only: never add landlord contacts, documents, exact address or internal notes.
export interface PropertySummary {
  id: string;
  slug: string;
  title: string;
  listing_type: ListingType;
  property_type: PropertyType;
  price: PropertyPrice;
  location: {
    state: string;
    city: string;
    neighbourhood: string;
    address_hint: string | null;
  };
  bedrooms: number;
  bathrooms: number;
  furnishing: Furnishing;
  availability_status: Availability;
  is_verified: boolean;
  verified_at: string | null;
  cover_image: PropertyImage | null;
  published_at: string | null;
}
export interface PropertyMedia {
  id: string;
  kind: "photo" | "video";
  url: string;
  thumb_url: string | null;
  alt: string | null;
  position: number;
}
export interface PropertyDetail extends PropertySummary {
  description: string;
  payment_terms: string | null;
  price_negotiable: boolean;
  extra_charges: (Money & { label: string })[];
  amenities: { code: string; label: string }[];
  media: PropertyMedia[];
  approximate_location: { lat: number; lng: number; radius_m: number } | null;
  verification: {
    status: "passed";
    verified_at: string;
    method: "desk_review" | "physical_inspection" | "both";
    scope: string[];
    disclaimer: string;
  } | null;
  last_availability_confirmed_at: string | null;
}
