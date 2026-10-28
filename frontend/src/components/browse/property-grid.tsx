import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/common/badge";
import { StatePanel } from "@/components/common/state-panel";
import { formatMoney } from "@/lib/formatters/money";
import type { PropertySummary } from "@/types/property";
export function PropertyGrid({
  properties,
}: {
  properties: readonly PropertySummary[];
}) {
  if (!properties.length)
    return (
      <StatePanel title="No properties to show">
        <p>Try another location or adjust your preferences.</p>
      </StatePanel>
    );
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {properties.map((property) => (
        <article
          key={property.id}
          className="overflow-hidden rounded-xl border bg-surface"
        >
          <div className="relative aspect-[4/3]">
            <Image
              src={
                property.cover_image.url.startsWith("/") &&
                !property.cover_image.url.startsWith("//")
                  ? property.cover_image.url
                  : "/assets/property-placeholder.svg"
              }
              alt={
                property.cover_image.url.startsWith("/") &&
                !property.cover_image.url.startsWith("//")
                  ? property.cover_image.alt
                  : "Property photo placeholder"
              }
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="space-y-3 p-5">
            {property.is_verified && (
              <Badge tone="success">Verified checks</Badge>
            )}
            <h2 className="text-xl">
              <Link href={`/properties/${encodeURIComponent(property.slug)}`}>
                {property.title}
              </Link>
            </h2>
            <p>
              {formatMoney(property.price.amount)}
              {property.price.period !== "one_time" &&
                `/${property.price.period}`}
            </p>
            <p className="text-sm text-muted">
              {property.bedrooms} bedrooms · {property.bathrooms} bathrooms ·{" "}
              {property.location.neighbourhood}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
