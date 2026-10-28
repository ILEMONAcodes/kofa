import type { Metadata } from "next";
import { SearchFilters } from "@/components/browse/search-filters";
import { StatePanel } from "@/components/common/state-panel";
export const metadata: Metadata = { title: "Explore properties" };
export default function Properties() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-primary">Your next chapter</p>
        <h1 className="mt-2 text-3xl md:text-4xl">Find your place.</h1>
      </div>
      <SearchFilters />
      <StatePanel title="Property search is being connected">
        <p>Listings will appear here once the property API is available.</p>
      </StatePanel>
    </div>
  );
}
