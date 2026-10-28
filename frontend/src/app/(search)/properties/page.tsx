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
    if (value !== undefined)
      params.set(key, Array.isArray(value) ? value.join(",") : value);
  const query = params.toString();
  return (
    <div className="search-page" data-node-id="14:220">
      <SearchNavigation />
      <main id="main-content">
        <DesktopSearch key={query} query={query} />
      </main>
      <div className="search-footer-surround" data-node-id="28:805">
        <HomeFooter showHelpActions={false} nodeId="28:806" />
      </div>
    </div>
  );
}
