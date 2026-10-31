import { parseMoneyInput } from "@/lib/formatters/money";
export const steps = [
  "contact",
  "property",
  "pricing",
  "features",
  "uploads",
  "review",
  "receipt",
  "verification",
] as const;
export type Step = (typeof steps)[number];
export const screens: Record<
  Step,
  {
    node: string;
    eyebrow: string;
    title: string;
    description: string;
    action: string;
  }
> = {
  contact: {
    node: "51:1580",
    eyebrow: "STEP 1 OF 6 · Contact registration",
    title: "Tell us about you.",
    description:
      "Register your contact details for this listing. No separate landlord account is needed.",
    action: "Continue to property",
  },
  property: {
    node: "51:1785",
    eyebrow: "STEP 2 OF 6 · Property details",
    title: "Introduce your property.",
    description:
      "Help our team understand the property and where it is located.",
    action: "Continue to pricing",
  },
  pricing: {
    node: "51:2002",
    eyebrow: "STEP 3 OF 6 · Pricing",
    title: "Make every cost clear.",
    description:
      "Tell us the price, payment terms and any additional property charges.",
    action: "Continue to features",
  },
  features: {
    node: "51:2203",
    eyebrow: "STEP 4 OF 6 · Features",
    title: "The details that matter.",
    description:
      "Let people know what the property offers and whether it is available.",
    action: "Continue to photos",
  },
  uploads: {
    node: "51:2380",
    eyebrow: "STEP 5 OF 6 · Photos & evidence",
    title: "Show the space. Share the proof.",
    description:
      "Add at least 5 property photos and 1 ownership or authorisation document. Evidence stays private.",
    action: "Review my listing",
  },
  review: {
    node: "51:2567",
    eyebrow: "STEP 6 OF 6 · Review & consent",
    title: "A final look before you submit.",
    description:
      "Check the information below. Our team will review the listing and contact you before publication.",
    action: "Submit for review",
  },
  receipt: {
    node: "51:2730",
    eyebrow: "NEXT STEPS",
    title: "Your property is with our team.",
    description:
      "Thanks for sharing it. Your submission is received; it is not yet verified or published.",
    action: "How verification works",
  },
  verification: {
    node: "51:2848",
    eyebrow: "NEXT STEPS",
    title: "Verification, step by step.",
    description:
      "Our team checks the submission, confirms the advertised details with you, and records the result.",
    action: "Back to home",
  },
};
export type Draft = Record<string, string>;
export const emptyDraft: Draft = {
  relationship: "",
  property_type: "apartment",
  intended_use: "residential",
  state: "FCT",
  city: "Abuja",
  area: "",
  listing_type: "rent",
  period: "year",
  negotiable: "no",
  payment_terms: "1 year upfront",
  charge_label: "",
  bedrooms: "",
  bathrooms: "",
  furnishing: "unfurnished",
  availability: "available",
  amenities: "",
};
export const sampleDraft: Draft = {
  ...emptyDraft,
  full_name: "Property owner",
  phone: "+2348012345678",
  email: "owner@example.com",
  relationship: "owner",
  title: "3-bedroom flat, Wuse 2",
  area: "Wuse 2",
  address: "12 Example Street, Wuse 2",
  hint: "Near the neighbourhood centre",
  description:
    "A bright three-bedroom apartment with generous living space in Wuse 2.",
  price: "3,500,000",
  charge_label: "Caution fee",
  charge: "350,000",
  bedrooms: "3",
  bathrooms: "3",
  amenities: "Parking,Generator,Fitted kitchen",
};
export type MediaKind = "photo" | "document" | "video";
export const limits = {
  photo: {
    max: 20,
    bytes: 10 * 1024 * 1024,
    types: ["image/jpeg", "image/png", "image/webp"],
  },
  document: {
    max: 10,
    bytes: 10 * 1024 * 1024,
    types: ["application/pdf", "image/jpeg", "image/png"],
  },
  video: {
    max: 1,
    bytes: 100 * 1024 * 1024,
    types: ["video/mp4", "video/webm"],
  },
};
export function fileProblem(
  kind: MediaKind,
  file: { type: string; size: number },
  count: number,
): string | null {
  const rule = limits[kind];
  if (count >= rule.max)
    return `Maximum ${rule.max} ${kind === "document" ? "evidence documents" : kind === "video" ? "video" : "photos"}.`;
  if (!rule.types.includes(file.type))
    return "This file type is not supported.";
  if (!file.size) return "This file is empty.";
  if (file.size > rule.bytes)
    return `Maximum ${kind === "video" ? 100 : 10} MB per file.`;
  return null;
}
export function stepProblem(
  step: Step,
  d: Draft,
  photos: number,
  documents: number,
): string | null {
  const requireFields = (keys: string[]) =>
    keys.some((k) => !(d[k] ?? "").trim());
  if (
    step === "contact" &&
    (requireFields(["full_name", "phone", "relationship"]) ||
      d.full_name.trim().length < 2 ||
      d.full_name.trim().length > 150 ||
      !/^\+[1-9]\d{6,14}$/.test(d.phone) ||
      (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)))
  )
    return "Enter your name, a phone in international format and relationship to the property. Check your optional email.";
  if (
    step === "property" &&
    (requireFields([
      "title",
      "property_type",
      "intended_use",
      "state",
      "city",
      "area",
      "address",
      "description",
    ]) ||
      d.title.trim().length < 5 ||
      d.title.trim().length > 120 ||
      d.description.trim().length < 20 ||
      d.description.trim().length > 5000)
  )
    return "Complete the property details, including a 5–120 character title and 20–5,000 character description.";
  if (step === "pricing") {
    try {
      const amount = parseMoneyInput(d.price ?? "");
      const charge = parseMoneyInput(d.charge ?? "");
      if (
        amount === null ||
        amount < 100000 ||
        (d.charge_label && charge === null) ||
        (!d.charge_label && charge !== null)
      )
        return "Enter a price of at least ₦1,000 and give each additional charge a label and valid amount.";
    } catch {
      return "Enter valid naira amounts with up to two decimal places.";
    }
  }
  if (
    step === "features" &&
    (requireFields(["bedrooms", "bathrooms", "furnishing", "availability"]) ||
      [d.bedrooms, d.bathrooms].some(
        (v) => v !== "other" && (!/^\d+$/.test(v) || Number(v) > 20),
      ))
  )
    return "Choose bedrooms, actual bathroom count, furnishing and availability.";
  if (
    ["contact", "property", "pricing", "features"].includes(step) &&
    Object.entries(d).some(
      ([key, value]) => value === "other" && !(d[`${key}Other`] ?? "").trim(),
    )
  )
    return "Specify your preference for each Other selection.";
  if (
    step === "features" &&
    d.amenities?.split(",").includes("other") &&
    !(d.amenitiesOther ?? "").trim()
  )
    return "Specify your other amenities.";
  if (step === "uploads" && (photos < 5 || documents < 1))
    return "Select at least 5 property photos and 1 ownership or authorisation document.";
  return null;
}
export function displayValue(d: Draft, key: string): string {
  return d[key] === "other"
    ? d[`${key}Other`] || "Not specified"
    : d[key] || "Not specified";
}
