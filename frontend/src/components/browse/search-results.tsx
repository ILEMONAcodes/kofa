import { buttonStyles } from "@/components/common/button";
import Image from "next/image";
import Link from "next/link";
import { MobilePropertyCard } from "@/components/mobile/property-card";
import { listingPrice, furnishingLabel } from "@/lib/property-presentation";
import { propertyDetailHref } from "@/lib/property-navigation";
import {
  publicCard,
  verificationLabel,
  availabilityLabel,
} from "@/lib/public-property";
import type { PublicPage, PublicResult } from "@/lib/api/public-server";
export function SearchResults({
  result,
  query = "",
}: {
  result: PublicResult<PublicPage>;
  query?: string;
}) {
  if (!result.ok)
    return (
      <section role="alert">
        <h2>Unable to load properties</h2>
        <p>{result.message}</p>
        {result.requestId && <p>Reference: {result.requestId}</p>}
        <Link href="/properties">Clear filters and try again</Link>
      </section>
    );
  const { data, meta } = result.value;
  if (!data.length)
    return (
      <section role="status">
        <h2>No properties found</h2>
        <p>Try another location or adjust your preferences.</p>
        <Link href="/properties">Clear filters</Link>
      </section>
    );
  const properties = data.map(publicCard);
  function pageHref(page: number) {
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    return `/properties?${params}`;
  }
  return (
    <>
      <div className="mobile-only mobile-result-cards">
        {properties.map((p) => (
          <MobilePropertyCard key={p.slug} property={p} query={query} />
        ))}
      </div>
      <div className="search-property-grid desktop-only">
        {properties.map((p) => {
          const href = propertyDetailHref(
            p.slug,
            query ? `/properties?${query}` : undefined,
          );
          return (
            <article
              key={p.slug}
              className="home-property-card search-property-card"
            >
              <Image
                src={p.image}
                alt={p.alt}
                fill
                sizes="(min-width: 1200px) 432px, 90vw"
                unoptimized
                className="home-cover"
              />
              <div className="home-card-gradient" />
              <Link
                href={`${href}#verification`}
                className="home-verification-badge"
              >
                {verificationLabel(p.verified_at)}
              </Link>
              <div className="home-card-copy">
                <h2 className="text-home-card">
                  <Link href={href} className="property-card-link">
                    {p.title}
                  </Link>
                </h2>
                <p className="text-home-card">{listingPrice(p.price)}</p>
                <p className="text-sm">
                  {p.bedrooms} bed · {p.bathrooms} bath ·{" "}
                  {furnishingLabel[p.furnishing]}
                </p>
                <p className="text-sm">{p.location}</p>
                <Link className="text-home-caption" href={href}>
                  {availabilityLabel(p.availability_status)} · View property ↗
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      <nav
        className="search-pagination order-3"
        aria-label="Results pagination"
      >
        {meta.page > 1 && (
          <Link
            className={buttonStyles("secondary")}
            href={pageHref(meta.page - 1)}
          >
            Previous
          </Link>
        )}
        <p className="text-muted" aria-live="polite">
          Page {meta.page} of {meta.total_pages} · {meta.total_items} properties
        </p>
        {meta.page < meta.total_pages && (
          <Link
            className={buttonStyles("primary")}
            href={pageHref(meta.page + 1)}
          >
            Next
          </Link>
        )}
      </nav>
    </>
  );
}
