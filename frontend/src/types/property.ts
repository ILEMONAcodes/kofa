import type { Money, PropertyPrice } from "./api";
export type ListingType = "rent" | "sale";
export type PropertyType =
  "apartment" | "house" | "duplex" | "bungalow" | "terrace" | "studio" | "room";
export type Furnishing = "furnished" | "semi_furnished" | "unfurnished";
export type Availability = "available" | "under_offer" | "unavailable";
export interface PropertyImage {
  url: string;
  thumb_url: string;
  alt: string;
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
    address_hint: string;
  };
  bedrooms: number;
  bathrooms: number;
  furnishing: Furnishing;
  availability_status: Availability;
  is_verified: boolean;
  verified_at: string | null;
  cover_image: PropertyImage;
  published_at: string;
}
export interface PropertyMedia {
  id: string;
  kind: "photo" | "video";
  url: string;
  thumb_url: string;
  alt: string;
  position: number;
}
export interface PropertyDetail extends PropertySummary {
  description: string;
  payment_terms: string;
  price_negotiable: boolean;
  extra_charges: (Money & { label: string })[];
  amenities: { code: string; label: string }[];
  media: PropertyMedia[];
  approximate_location: { lat: number; lng: number; radius_m: number };
  verification: {
    status: "passed";
    verified_at: string;
    method: "desk" | "physical" | "both";
    scope: string[];
    disclaimer: string;
  };
  last_availability_confirmed_at: string;
}
