"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HomeLink } from "./home-link";
import {
  safePropertiesReturn,
  propertyDetailHref,
} from "@/lib/property-navigation";
export function DetailBreadcrumb({ neighbourhood }: { neighbourhood: string }) {
  const params = useSearchParams();
  const back = safePropertiesReturn(params.get("returnTo") ?? undefined);
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-primary">
      <Link href={back}>Properties</Link> /{" "}
      <Link href="/properties?city=Abuja">Abuja</Link> /{" "}
      <Link
        href={`/properties?${new URLSearchParams({ city: "Abuja", area: neighbourhood.toLowerCase().replaceAll(" ", "-") })}`}
      >
        {neighbourhood}
      </Link>
    </nav>
  );
}
export function DetailInterestLink({ slug }: { slug: string }) {
  const params = useSearchParams();
  const back = safePropertiesReturn(params.get("returnTo") ?? undefined);
  const current = propertyDetailHref(
    slug,
    back !== "/properties" ? back : undefined,
  );
  return (
    <HomeLink
      href={`/login?${new URLSearchParams({ returnTo: current })}`}
      variant="primary"
      className="w-full"
    >
      Express interest
    </HomeLink>
  );
}
