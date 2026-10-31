"use client";
import { useState } from "react";
import { MobilePropertyCard } from "@/components/mobile/property-card";
import Image from "next/image";
import { propertyDetailHref } from "@/lib/property-navigation";
import Link from "next/link";
import { Button } from "@/components/common/button";
import { illustrativeListings } from "./home-content";
import { listingPrice, furnishingLabel } from "@/lib/property-presentation";
const sourceIds = ["15:292", "15:304", "15:317", "15:329", "15:342", "15:354"];
export function SearchResults({
  sort,
  query = "",
}: {
  sort: string;
  query?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const mobileProperties = [...illustrativeListings];
  if (sort === "price" || sort === "-price")
    mobileProperties.sort(
      (a, b) => (a.price.amount - b.price.amount) * (sort === "price" ? 1 : -1),
    );
  const slots = illustrativeListings.map((property, slot) => ({
    property,
    slot,
  }));
  if (sort === "price" || sort === "-price")
    slots.sort(
      (a, b) =>
        (a.property.price.amount - b.property.price.amount) *
        (sort === "price" ? 1 : -1),
    );
  return (
    <>
      <div className="mobile-only mobile-result-cards">
        <div className="mobile-applied-filters">
          <span>Available</span>
          <span>
            {sort === "price"
              ? "Price: low to high"
              : sort === "-price"
                ? "Price: high to low"
                : "Newest first"}
          </span>
        </div>
        <p className="text-sm text-muted">
          {illustrativeListings.length} properties
        </p>
        {(expanded ? mobileProperties : mobileProperties.slice(0, 6)).map(
          (property, index) => (
            <MobilePropertyCard key={index} property={property} query={query} />
          ),
        )}
        <p className="text-sm text-muted">
          Showing {expanded ? mobileProperties.length : 6} of{" "}
          {mobileProperties.length} properties
        </p>
        {!expanded && (
          <Button onClick={() => setExpanded(true)}>
            Load more properties
          </Button>
        )}
        <p className="text-home-caption text-muted">
          Find a place to call your own.
        </p>
      </div>
      <div className="search-property-grid desktop-only">
        {slots.map(({ property, slot }) => (
          <article
            className="home-property-card search-property-card"
            key={slot}
            data-node-id={sourceIds[slot]}
          >
            <Image
              src={property.image}
              alt={property.alt}
              fill
              sizes="(min-width: 1200px) 432px, (min-width: 768px) 40vw, 90vw"
              unoptimized
              className="home-cover"
              data-search-asset={`card-${slot + 1}`}
            />
            <div className="home-card-gradient" />
            <Link
              href={propertyDetailHref(
                property.slug,
                query ? `/properties?${query}` : undefined,
                "verification",
              )}
              className="home-verification-badge"
            >
              Verified on 20 Oct 2026
            </Link>
            <div className="home-card-copy">
              <h2 className="text-home-card">
                <Link
                  className="property-card-link"
                  href={propertyDetailHref(
                    property.slug,
                    query ? `/properties?${query}` : undefined,
                  )}
                >
                  {property.title}
                </Link>
              </h2>
              <p className="text-home-card">{listingPrice(property.price)}</p>
              <p className="text-sm">
                {property.bedrooms} bed · {property.bathrooms} bath ·{" "}
                {furnishingLabel[property.furnishing]}
              </p>
              <p className="text-sm">{property.location}</p>
              <Link
                className="text-home-caption"
                href={propertyDetailHref(
                  property.slug,
                  query ? `/properties?${query}` : undefined,
                )}
              >
                Available · View property ↗
              </Link>
            </div>
          </article>
        ))}
      </div>
      <nav
        className="search-pagination desktop-only"
        aria-label="Results pagination"
        data-node-id="15:366"
      >
        <Button variant="subtle" className="w-[140px]" disabled>
          Previous
        </Button>
        <Button className="w-12" aria-current="page" aria-label="Page 1">
          1
        </Button>
        <p className="text-muted">Page 1 of 1</p>
        <Button variant="subtle" className="w-[100px]" disabled>
          Next
        </Button>
      </nav>
    </>
  );
}
