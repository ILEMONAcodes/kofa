import { illustrativeListings, type HomeListing } from "./home-content";
export interface DetailPhoto {
  src: string;
  alt: string;
  label: string;
}
export interface PreviewDetail extends HomeListing {
  neighbourhood: string;
  description: string;
  features: string | null;
  cautionFee: number | null;
  paymentTerms: string | null;
  photos: DetailPhoto[];
}
export function previewDetail(slug: string): PreviewDetail | undefined {
  const listing = illustrativeListings.find(
    (property) => property.slug === slug,
  );
  if (!listing) return undefined;
  const source = slug === "3-bedroom-flat-wuse-2";
  const order = source
    ? [
        illustrativeListings[0],
        illustrativeListings[2],
        illustrativeListings[1],
      ]
    : illustrativeListings
          .slice(0, 3)
          .some((property) => property.slug === slug)
      ? [
          listing,
          ...illustrativeListings
            .slice(0, 3)
            .filter((property) => property.slug !== slug),
        ]
      : [listing];
  return {
    ...listing,
    neighbourhood: listing.location.split(",")[0],
    description: source
      ? "A bright apartment with generous living space, fitted kitchen and parking. This description is illustrative content for the design preview."
      : "This property is illustrative content for the design preview. Further property information will be supplied when live listings are connected.",
    features: source ? "Parking  ·  Generator  ·  Fitted kitchen" : null,
    cautionFee: source ? 35000000 : null,
    paymentTerms: source ? "1 year upfront" : null,
    photos: order.map((property) => ({
      src: property.image,
      alt: property.alt,
      label: property.image.startsWith("/assets/properties/")
        ? "Sample cover photo"
        : property.image.includes("architecture")
          ? "Exterior"
          : "Living room",
    })),
  };
}
