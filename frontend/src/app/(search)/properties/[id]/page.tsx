import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchNavigation } from "@/components/browse/search-navigation";
import { HomeFooter } from "@/components/browse/home-footer";
import { HomeLink } from "@/components/browse/home-link";
import { previewDetail } from "@/components/browse/detail-content";
import { illustrativeListings } from "@/components/browse/home-content";
import { PropertyGallery } from "@/components/browse/detail-gallery";
import { DetailActions } from "@/components/browse/detail-actions";
import {
  DetailBreadcrumb,
  DetailInterestLink,
} from "@/components/browse/detail-navigation-links";

import { formatMoney } from "@/lib/formatters/money";
// This design preview has exactly three known slugs. Real publication gating belongs to the public API.
export const dynamicParams = false;
export function generateStaticParams() {
  return illustrativeListings.map((property) => ({ id: property.slug }));
}
type Props = {
  params: Promise<{ id: string }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const property = previewDetail((await params).id);
  return {
    title: property?.title ?? "Property not found",
    description: property
      ? `${property.title} · ${property.location}. Fictional property design preview.`
      : undefined,
    robots: { index: false, follow: false },
  };
}
export default async function PropertyDetail({ params }: Props) {
  // Public URL value is a slug, despite the requested [id] folder name.
  const property = previewDetail((await params).id);
  if (!property) notFound();
  return (
    <div className="search-page detail-page" data-node-id="14:221">
      <SearchNavigation detail assistantHref="#assistant" />
      <main id="main-content">
        <section
          className="detail-header"
          data-node-id="15:414"
          aria-labelledby="property-title"
        >
          <Suspense
            fallback={
              <nav aria-label="Breadcrumb" className="text-sm text-primary">
                <Link href="/properties">Properties</Link> /{" "}
                <Link href="/properties?city=Abuja">Abuja</Link> /{" "}
                <span>{property.neighbourhood}</span>
              </nav>
            }
          >
            <DetailBreadcrumb neighbourhood={property.neighbourhood} />
          </Suspense>
          <a href="#verification" className="detail-badge">
            Verified on 20 Oct 2026
          </a>
          <h1
            id="property-title"
            className="detail-title"
            data-node-id="15:418"
          >
            {property.title}
          </h1>
          <p className="text-muted">
            {property.location} · Approximate location
          </p>
          <PropertyGallery photos={property.photos} />
        </section>
        <section
          className="detail-facts"
          data-node-id="15:425"
          aria-label="Property facts and interest"
        >
          <div className="detail-information" data-node-id="15:426">
            <h2 className="text-home-title">Space for your next chapter.</h2>
            <p className="font-medium">
              {property.bedrooms} bed · {property.bathrooms} bath ·{" "}
              {property.furnishing === "furnished"
                ? "Furnished"
                : "Unfurnished"}
            </p>
            <p className="text-muted">{property.description}</p>
            <hr />
            <h3 className="text-home-card">Features</h3>
            <p className="text-muted">
              {property.features ??
                "Feature details are not supplied for this sample listing."}
            </p>
            <h3
              id="verification"
              className="text-home-card scroll-mt-8"
              tabIndex={-1}
            >
              Verification / 20 Oct 2026
            </h3>
            <div className="text-muted">
              <p>Method: desk review and physical inspection</p>
              <p>
                Checks: identity, ownership documents, location, price and
                features.
              </p>
            </div>
            <aside className="detail-notice">
              <p className="font-medium text-primary">Understand the checks</p>
              <p>
                Verification confirms the checks listed. It is not a guarantee
                of legal title.
              </p>
            </aside>
            <h3 className="text-home-card">The neighbourhood</h3>
            <aside className="detail-notice">
              <p className="font-medium text-primary">
                {property.location} · Approximate location
              </p>
              <p>
                Exact address is shared through the inspection process. This
                public view shows the neighbourhood only.
              </p>
            </aside>
            <DetailActions photos={property.photos} title={property.title} />
          </div>
          <aside
            className="detail-interest"
            data-node-id="15:443"
            aria-label="Price and availability"
          >
            <p className="text-home-title text-primary">
              {formatMoney(property.price.amount)} /year
            </p>
            <p className="text-sm text-muted">
              Payment terms:{" "}
              {property.paymentTerms ?? "Not supplied in this preview"}
            </p>
            <hr />
            <h2 className="text-sm font-medium">Additional property charge</h2>
            <p>
              {property.cautionFee !== null
                ? `Caution fee: ${formatMoney(property.cautionFee)}`
                : "No charge details supplied for this sample."}
            </p>
            <p className="text-sm text-muted">
              Our team will explain any service fees before you agree to
              proceed.
            </p>
            <span className="detail-badge">Available</span>
            <p className="text-sm text-muted">
              Availability last confirmed 20 Oct 2026
            </p>
            <Suspense
              fallback={
                <HomeLink
                  href={`/login?${new URLSearchParams({ returnTo: `/properties/${property.slug}` })}`}
                  variant="primary"
                  className="w-full"
                >
                  Express interest
                </HomeLink>
              }
            >
              <DetailInterestLink slug={property.slug} />
            </Suspense>
            <p className="text-sm text-muted">
              Log in or create an account to continue. Our team will arrange
              this for you.
            </p>
          </aside>
        </section>
      </main>
      <div className="search-footer-surround" data-node-id="28:850">
        <HomeFooter showHelpActions={false} nodeId="28:851" />
      </div>
    </div>
  );
}
