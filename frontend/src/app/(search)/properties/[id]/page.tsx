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

import {
  listingPrice,
  pricePeriodLabel,
  furnishingLabel,
} from "@/lib/property-presentation";
import { formatMoney } from "@/lib/formatters/money";
// This uses the twelve known sample slugs. Real publication gating belongs to the public API.
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
      ? `${property.title} · ${property.location}. Property details and photos.`
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
            <span>{property.title.split(",")[0]},</span>
            <span className="detail-title-neighbourhood">
              {" "}
              {property.neighbourhood}
            </span>
          </h1>
          <p className="text-muted detail-location desktop-only">
            {property.location} · Approximate location
          </p>
          <div className="mobile-only mobile-detail-location">
            {/* eslint-disable-next-line @next/next/no-img-element -- Exact mobile Figma location vector. */}
            <img
              src="/assets/mobile-location.svg"
              width="22"
              height="22"
              alt=""
            />
            <span>{property.location}</span>
          </div>
          <PropertyGallery photos={property.photos} />
        </section>
        <section
          className="detail-facts"
          data-node-id="15:425"
          aria-label="Property facts and interest"
        >
          <div className="detail-information" data-node-id="15:426">
            <h2 className="text-home-title desktop-only">
              Space for your next chapter.
            </h2>
            <p className="font-medium">
              {property.bedrooms} bed · {property.bathrooms} bath ·{" "}
              {furnishingLabel[property.furnishing]}
            </p>
            <p className="text-muted desktop-only">{property.description}</p>
            <div className="mobile-only mobile-detail-intro">
              <span className="detail-badge">Available</span>
              <h2>A home with room to breathe.</h2>
              <p className="text-muted">
                {property.slug === "3-bedroom-flat-wuse-2"
                  ? "Bright living spaces, a fitted kitchen and parking."
                  : property.description}
              </p>
              <p>
                {property.paymentTerms ?? "Payment terms not supplied"}
                <br />
                {property.cautionFee !== null
                  ? `Caution fee: ${formatMoney(property.cautionFee)}`
                  : "Charge details not supplied"}
              </p>
              <p className="text-sm text-muted">
                Availability last confirmed 20 Oct 2026
              </p>
            </div>
            <hr className="desktop-only" />
            <h3 className="text-home-card desktop-only">Features</h3>
            <p className="text-muted desktop-only">
              {property.features ??
                "Contact our team for more information about this property’s features."}
            </p>
            <section id="verification" className="detail-verification">
              <div className="desktop-verification">
                <h3
                  id="verification-heading"
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
                  <p className="font-medium text-primary">
                    Understand the checks
                  </p>
                  <p>
                    Verification confirms the checks listed. It is not a
                    guarantee of legal title.
                  </p>
                </aside>
              </div>
              <div className="mobile-only mobile-notice">
                <h3>Verification / 20 Oct 2026</h3>
                <p>
                  Desk review and physical inspection. Identity, ownership
                  documents, location, price and features checked. Verification
                  is not a guarantee of legal title.
                </p>
              </div>
            </section>
            <h3 className="text-home-card desktop-only">The neighbourhood</h3>
            <aside className="detail-notice desktop-only">
              <p className="font-medium text-primary">
                {property.location} · Approximate location
              </p>
              <p>
                Exact address is shared through the inspection process. This
                public view shows the neighbourhood only.
              </p>
            </aside>
            <aside className="mobile-only mobile-notice">
              <h3>Approximate location</h3>
              <p>
                {property.location}. Our team manages exact-address disclosure
                through the inspection process.
              </p>
            </aside>
            <DetailActions photos={property.photos} title={property.title} />
          </div>
          <aside
            className="detail-interest desktop-only"
            data-node-id="15:443"
            aria-label="Price and availability"
          >
            <p className="text-home-title text-primary">
              {listingPrice(property.price)}
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
      <aside
        className="mobile-only mobile-interest-bar"
        aria-label="Price and interest"
      >
        <div>
          <p>{formatMoney(property.price.amount)}</p>
          <span>
            {pricePeriodLabel(property.price)} ·{" "}
            {property.paymentTerms ?? "Contact our team for details"}
          </span>
        </div>
        <Suspense
          fallback={
            <HomeLink href="/login" variant="primary">
              Express interest
            </HomeLink>
          }
        >
          <DetailInterestLink slug={property.slug} />
        </Suspense>
      </aside>
      <div className="search-footer-surround" data-node-id="28:850">
        <HomeFooter showHelpActions={false} nodeId="28:851" />
      </div>
    </div>
  );
}
