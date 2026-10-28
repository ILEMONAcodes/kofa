import type { PropertySummary } from "@/types/property";
// Design-only content transcribed from node 14:219. No API endpoint is mocked.
export type HomeListing = Pick<
  PropertySummary,
  "slug" | "title" | "price" | "bedrooms" | "bathrooms" | "furnishing"
> & { image: string; alt: string; location: string };
export const illustrativeListings: readonly HomeListing[] = [
  {
    slug: "3-bedroom-flat-wuse-2",
    title: "3-bedroom flat, Wuse 2",
    price: { amount: 350000000, currency: "NGN", period: "year" },
    bedrooms: 3,
    bathrooms: 3,
    furnishing: "unfurnished",
    image: "/assets/home-living-room.jpg",
    alt: "Illustrative bright living room with a sofa and wood accent wall",
    location: "Wuse 2, Abuja",
  },
  {
    slug: "4-bedroom-duplex-gwarinpa",
    title: "4-bedroom duplex, Gwarinpa",
    price: { amount: 600000000, currency: "NGN", period: "year" },
    bedrooms: 4,
    bathrooms: 4,
    furnishing: "unfurnished",
    image: "/assets/home-architecture.jpg",
    alt: "Illustrative contemporary home at dusk",
    location: "Gwarinpa, Abuja",
  },
  {
    slug: "2-bedroom-flat-jabi",
    title: "2-bedroom flat, Jabi",
    price: { amount: 250000000, currency: "NGN", period: "year" },
    bedrooms: 2,
    bathrooms: 2,
    furnishing: "furnished",
    image: "/assets/home-jabi.jpg",
    alt: "Illustrative furnished open-plan living room",
    location: "Jabi, Abuja",
  },
];
export const journeySteps = [
  {
    number: "01",
    title: "Discover your options",
    body: "Browse prices, availability and the scope of each property’s checks.",
  },
  {
    number: "02",
    title: "Start a conversation",
    body: "Express interest and keep your conversation with our team in one place.",
  },
  {
    number: "03",
    title: "Visit with clarity",
    body: "Our team arranges the inspection and explains what follows.",
  },
] as const;
