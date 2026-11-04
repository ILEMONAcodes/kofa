import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchNavigation } from "@/components/browse/search-navigation";
import { HomeFooter } from "@/components/browse/home-footer";
import { HomeLink } from "@/components/browse/home-link";
import { publicDetail } from "@/lib/api/public-server";
import {
  publicCard,
  verificationLabel,
  availabilityLabel,
} from "@/lib/public-property";
import { formatStaffDate } from "@/lib/formatters/date";

import { PropertyGallery } from "@/components/browse/detail-gallery";
import { DetailActions } from "@/components/browse/detail-actions";
import {
  DetailInterestLink,
  DetailBreadcrumb,
} from "@/components/browse/detail-navigation-links";

import {
  listingPrice,
  pricePeriodLabel,
  furnishingLabel,
} from "@/lib/property-presentation";
import { formatMoney } from "@/lib/formatters/money";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ id: string }>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = await publicDetail((await params).id);
  if (!result.ok && result.status === 404) notFound();
  const property = result.ok ? result.value.data : null;
  return {
    title: property?.title ?? "Property not found",
    description: property
      ? `${property.title} · ${property.location.neighbourhood}, ${property.location.city}. Property details and photos.`
      : undefined,
    robots: { index: !!property, follow: !!property },
  };
}
export default async function PropertyDetail({ params }: Props) {
  // Public URL value is a slug, despite the requested [id] folder name.
  const result = await publicDetail((await params).id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <div className="search-page detail-page">
        <SearchNavigation />
        <main id="main-content" className="detail-header">
          <h1>Unable to load this property</h1>
          <p role="alert">{result.message}</p>
          {result.requestId && <p>Reference: {result.requestId}</p>}
          <Link href="/properties">Back to properties</Link>
        </main>
      </div>
    );
  }
  const data = result.value.data;
  const photos = data.media
    .filter((m) => m.kind === "photo")
    .map((m) => ({
      src: m.url,
      alt: m.alt ?? data.title,
      label: m.alt ?? "Property photo",
    }));
  const property = {
    ...publicCard(data),
    neighbourhood: data.location.neighbourhood,
    description: data.description,
    features: data.amenities.map((a) => a.label).join(" · "),
    paymentTerms: data.payment_terms,
    photos,
  };
  const confirmed = data.last_availability_confirmed_at
    ? `Availability last confirmed ${formatStaffDate(data.last_availability_confirmed_at, "date")}`
    : "Availability confirmation pending";
  const verificationCopy = data.verification
    ? `${data.verification.method.replaceAll("_", " ")} · ${data.verification.scope.map((c) => c.replaceAll("_", " ")).join(", ")}.`
    : "Verification details are unavailable.";
  const charges = data.extra_charges.length ? (
    data.extra_charges.map((c, i) => (
      <p key={i}>
        {c.label}: {formatMoney(c.amount)}
      </p>
    ))
  ) : (
    <p>No additional property charges supplied.</p>
  );

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
            <DetailBreadcrumb
              neighbourhood={property.neighbourhood}
              city={data.location.city}
            />
          </Suspense>
          <a href="#verification" className="detail-badge">
            {verificationLabel(data.verified_at)}
          </a>
          <h1
            id="property-title"
            className="detail-title"
            data-node-id="15:418"
          >
            {property.title}
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
          {photos.length ? (
            <PropertyGallery
              photos={photos}
              videos={data.media.filter((m) => m.kind === "video")}
            />
          ) : (
            <p className="detail-notice">
              Photos are not available for this property.
            </p>
          )}
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
              <span className="detail-badge">
                {availabilityLabel(data.availability_status)}
              </span>
              <h2>A home with room to breathe.</h2>
              <p className="text-muted">{property.description}</p>
              <p>
                {property.paymentTerms ?? "Payment terms not supplied"}
                <br />
              </p>
              {charges}
              <p className="text-sm text-muted">{confirmed}</p>
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
                  {verificationLabel(data.verified_at)}
                </h3>
                <div className="text-muted">
                  <p>{verificationCopy}</p>
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
                <h3>{verificationLabel(data.verified_at)}</h3>
                <p>
                  {verificationCopy} {data.verification?.disclaimer}
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
            {data.media
              .filter((m) => m.kind === "video")
              .map((m) => (
                <section key={m.id} aria-label="Property video">
                  <h3>Video walkthrough</h3>
                  <video
                    className="w-full rounded-xl"
                    controls
                    preload="metadata"
                    aria-label={m.alt ?? "Property walkthrough"}
                    src={m.url}
                  >
                    <track kind="captions" />
                  </video>
                </section>
              ))}
            <DetailActions
              photos={photos}
              videos={data.media.filter((m) => m.kind === "video")}
              title={property.title}
            />
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
              {property.paymentTerms ?? "Contact our team for details"}
            </p>
            <hr />
            <h2 className="text-sm font-medium">Additional property charge</h2>
            {charges}
            <p className="text-sm text-muted">
              Our team will explain any service fees before you agree to
              proceed.
            </p>
            <span className="detail-badge">
              {availabilityLabel(data.availability_status)}
            </span>
            <p className="text-sm text-muted">{confirmed}</p>
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
