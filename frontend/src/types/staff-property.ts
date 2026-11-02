import type { PropertyPrice, Pagination } from "./api";
export type StaffStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "unpublished"
  | "rejected"
  | "archived";
export type Availability = "available" | "under_offer" | "unavailable";
export interface StaffSummary {
  id: string;
  slug: string;
  title: string;
  status: StaffStatus;
  version: number;
  submission_reference: string | null;
  price: PropertyPrice;
  listing_type: "rent" | "sale";
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  furnishing: string;
  location: {
    state: string;
    city: string;
    neighbourhood: string;
    address_hint: string | null;
  };
  landlord_id: string;
  assigned_staff: { id: string; full_name: string } | null;
  availability_status: Availability;
  submitted_at: string | null;
  is_verified: boolean;
  verified_at: string | null;
  updated_at: string;
  published_at: string | null;
  cover_image: {
    url: string;
    thumb_url: string | null;
    alt: string | null;
  } | null;
}
export interface StaffLandlord {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  identity_verified_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface StaffMedia {
  id: string;
  kind: "photo" | "video";
  url: string;
  thumb_url: string | null;
  alt: string | null;
  position: number;
  is_cover: boolean;
}
export interface StaffDocument {
  id: string;
  kind: string;
  signed_url: string;
  expires_at: string;
  review_note: string | null;
}
export interface StaffDetail extends StaffSummary {
  description: string;
  intended_use: string;
  area_id: string;
  address_line: string;
  latitude: number | null;
  longitude: number | null;
  payment_terms: string | null;
  price_negotiable: boolean;
  extra_charges: { label: string; amount: number; currency: "NGN" }[];
  amenities: { code: string; label: string }[];
  media: StaffMedia[];
  documents: StaffDocument[];
  landlord: StaffLandlord & { relationship: string };
  landlord_conditions: string | null;
  last_availability_confirmed_at: string | null;
  status_history: {
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
  }[];
  verification_history: {
    id: string;
    status: string;
    method: string;
    scope_summary: string | null;
    verified_at: string | null;
    checks: { code: string; result: string; note: string | null }[];
  }[];
  landlord_approval: {
    id: string;
    approved_price: PropertyPrice;
    description_approved: boolean;
    method: string;
    approved_at: string;
    note: string | null;
  } | null;
}
export interface StaffOptions {
  areas: {
    id: string;
    slug: string;
    state: string;
    city: string;
    neighbourhood: string;
  }[];
  amenities: { code: string; label: string }[];
  staff: { id: string; full_name: string }[];
}
export interface StaffPage<T> {
  data: T[];
  meta: Pagination;
}
export interface StaffOwnerDetail extends StaffLandlord {
  properties: StaffSummary[];
}
export interface StaffMutation {
  id: string;
  status: StaffStatus;
  version: number;
  approval_invalidated: boolean;
  assigned_staff_id: string | null;
  availability_status: Availability;
  last_availability_confirmed_at: string | null;
}
