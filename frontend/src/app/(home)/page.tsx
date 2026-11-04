import { publicSearch, publicTaxonomy } from "@/lib/api/public-server";
import { publicCard } from "@/lib/public-property";
export const dynamic = "force-dynamic";
import { MobileHome } from "@/components/mobile/home";
import { Hero } from "@/components/browse/hero";
import { HomeSearch } from "@/components/browse/home-search";
import { FeaturedProperties } from "@/components/browse/featured-properties";
import { HomeJourney } from "@/components/browse/home-journey";
import { HomeTrust } from "@/components/browse/home-trust";
import { HomeClosing } from "@/components/browse/home-closing";
import { HomeFooter } from "@/components/browse/home-footer";
export default async function Home() {
  const [result, taxonomy] = await Promise.all([
    publicSearch("page_size=12"),
    publicTaxonomy(),
  ]);
  const cities = taxonomy.ok
    ? [...new Set(taxonomy.value.data.areas.map((a) => a.city))]
    : [];
  const properties = result.ok ? result.value.data.map(publicCard) : [];
  return (
    <div className="home-page" data-node-id="14:219">
      <main id="main-content" className="home-main">
        <MobileHome properties={properties} unavailable={!result.ok} />
        <div className="desktop-home-content">
          <Hero />
          <HomeSearch cities={cities} />
          <FeaturedProperties
            properties={properties}
            unavailable={!result.ok}
          />
          <HomeJourney />
          <HomeTrust />
          <HomeClosing />
        </div>
      </main>
      <HomeFooter />
    </div>
  );
}
