import { Hero } from "@/components/browse/hero";
import { HomeSearch } from "@/components/browse/home-search";
import { FeaturedProperties } from "@/components/browse/featured-properties";
import { HomeJourney } from "@/components/browse/home-journey";
import { HomeTrust } from "@/components/browse/home-trust";
import { HomeClosing } from "@/components/browse/home-closing";
import { HomeFooter } from "@/components/browse/home-footer";
export default function Home() {
  return (
    <div className="home-page" data-node-id="14:219">
      <main id="main-content" className="home-main">
        <Hero />
        <HomeSearch />
        <FeaturedProperties />
        <HomeJourney />
        <HomeTrust />
        <HomeClosing />
      </main>
      <HomeFooter />
    </div>
  );
}
