import { publicSearch, publicTaxonomy } from "@/lib/api/public-server";
import { publicChoices } from "@/lib/public-search-options";
export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { SearchNavigation } from "@/components/browse/search-navigation";
import { DesktopSearch } from "@/components/browse/desktop-search";
import { HomeFooter } from "@/components/browse/home-footer";
export const metadata: Metadata = { title: "Explore properties" };
export default async function Properties({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) {
      for (const entry of Array.isArray(value) ? value : [value])
        params.append(key, entry);
    }
  const openFilters = params.get("filters") === "open";
  params.delete("filters");
  if (!params.size) {
    params.set("listing_type", "rent");
    params.set("city", "Abuja");
  }
  const query = params.toString();
  const displayQuery = openFilters
    ? `${query}${query ? "&" : ""}filters=open`
    : query;
  const [result, taxonomy] = await Promise.all([
    publicSearch(query),
    publicTaxonomy(),
  ]);
  return (
    <div className="search-page" data-node-id="14:220">
      <SearchNavigation />
      <main id="main-content">
        <DesktopSearch
          key={displayQuery}
          query={displayQuery}
          result={result}
          choices={taxonomy.ok ? publicChoices(taxonomy.value.data) : undefined}
        />
      </main>
      <div className="search-footer-surround" data-node-id="28:805">
        <HomeFooter showHelpActions={false} nodeId="28:806" />
      </div>
    </div>
  );
}
