import Image from "next/image";
import { propertyDetailHref } from "@/lib/property-navigation";
import Link from "next/link";
import { Button } from "@/components/common/button";
import { illustrativeListings } from "./home-content";
import { formatMoney } from "@/lib/formatters/money";
// Six slots are transcribed from 14:220, including its repeated illustrative cards.
const sourceSlots = [0, 1, 1, 2, 2, 0] as const;
const sourceIds = ["15:292", "15:304", "15:317", "15:329", "15:342", "15:354"];
export function SearchResults({
  sort,
  query = "",
}: {
  sort: string;
  query?: string;
}) {
  const slots = sourceSlots.map((index, slot) => ({
    property: illustrativeListings[index],
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
      <div className="search-property-grid">
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
                  href={propertyDetailHref(
                    property.slug,
                    query ? `/properties?${query}` : undefined,
                  )}
                >
                  {property.title}
                </Link>
              </h2>
              <p className="text-home-card">
                {formatMoney(property.price.amount)} /year
              </p>
              <p className="text-sm">
                {property.bedrooms} bed · {property.bathrooms} bath ·{" "}
                {property.furnishing === "furnished"
                  ? "Furnished"
                  : "Unfurnished"}
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
        className="search-pagination"
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
