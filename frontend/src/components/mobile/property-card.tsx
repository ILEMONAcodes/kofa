import Image from "next/image";
import Link from "next/link";
import type { HomeListing } from "@/components/browse/home-content";
import { formatMoney } from "@/lib/formatters/money";
import { propertyDetailHref } from "@/lib/property-navigation";
export function MobilePropertyCard({
  property,
  image,
  imageAlt,
  query = "",
}: {
  property: HomeListing;
  image?: string;
  imageAlt?: string;
  query?: string;
}) {
  const href = propertyDetailHref(
    property.slug,
    query ? `/properties?${query}` : undefined,
  );
  return (
    <article className="mobile-property-card">
      <Image
        src={image ?? property.image}
        alt={imageAlt ?? property.alt}
        fill
        unoptimized
        sizes="350px"
        className="home-cover"
      />
      <div className="home-card-gradient" />
      <Link className="home-verification-badge" href={`${href}#verification`}>
        Verified on 20 Oct 2026
      </Link>
      <div className="home-card-copy">
        <h3 className="text-home-card">
          <Link href={href}>{property.title}</Link>
        </h3>
        <p className="text-home-card">
          {formatMoney(property.price.amount)} /year
        </p>
        <p className="text-sm">
          {property.bedrooms} bed · {property.bathrooms} bath ·{" "}
          {property.furnishing === "furnished" ? "Furnished" : "Unfurnished"}
        </p>
        <p className="text-sm">{property.location}</p>
        <Link className="text-home-caption" href={href}>
          Available · View property ↗
        </Link>
      </div>
    </article>
  );
}
