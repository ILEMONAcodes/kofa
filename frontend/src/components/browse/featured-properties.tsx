import { verificationLabel, availabilityLabel } from "@/lib/public-property";
import Image from "next/image";
import Link from "next/link";
import type { HomeListing } from "./home-content";
import { HomeLink } from "./home-link";
import { listingPrice, furnishingLabel } from "@/lib/property-presentation";
export function FeaturedProperties({
  properties,
  unavailable = false,
}: {
  properties: HomeListing[];
  unavailable?: boolean;
}) {
  return (
    <section
      className="home-featured"
      data-node-id="28:658"
      aria-labelledby="featured-title"
    >
      <div className="home-featured-heading">
        <h2 id="featured-title">
          <span className="block text-home-section">Spaces with</span>
          <span className="block font-editorial text-home-serif italic text-primary">
            possibility.
          </span>
        </h2>
        <div className="home-featured-intro">
          <p className="text-muted">
            Explore homes with transparent prices and a clear record of
            verification.
          </p>
          <HomeLink href="/properties" className="home-view-cta">
            View properties ↗
          </HomeLink>
        </div>
      </div>
      {!properties.length && (
        <p role="status">
          {unavailable
            ? "Properties are unavailable right now. Please try again."
            : "New homes will appear here when available."}
        </p>
      )}
      <div className="home-property-grid">
        {properties.slice(0, 3).map((property, index) => (
          <article
            key={property.slug}
            className="home-property-card"
            data-node-id={["28:677", "28:688", "28:699"][index]}
          >
            <Image
              src={property.image}
              alt={property.alt}
              fill
              sizes="422px"
              unoptimized
              className="home-cover"
              data-asset-slot={`card-${index + 1}`}
            />
            <div className="home-card-gradient" />
            <Link
              href={`/properties/${property.slug}#verification`}
              className="home-verification-badge"
            >
              {verificationLabel(property.verified_at)}
            </Link>
            <div className="home-card-copy">
              <h3 className="text-home-card">
                <Link
                  className="property-card-link"
                  href={`/properties/${property.slug}`}
                >
                  {property.title}
                </Link>
              </h3>
              <p className="text-home-card">{listingPrice(property.price)}</p>
              <p className="text-sm">
                {property.bedrooms} bed · {property.bathrooms} bath ·{" "}
                {furnishingLabel[property.furnishing]}
              </p>
              <p className="text-sm">{property.location}</p>
              <Link
                className="text-home-caption"
                href={`/properties/${property.slug}`}
              >
                {availabilityLabel(property.availability_status)} · View
                property ↗
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="text-home-caption text-muted">
        Find your next home in Abuja.
      </p>
    </section>
  );
}
