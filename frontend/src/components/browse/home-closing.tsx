import Image from "next/image";
import { HomeLink } from "./home-link";
export function HomeClosing() {
  return (
    <section
      className="home-closing"
      data-node-id="28:748"
      aria-labelledby="closing-title"
    >
      <Image
        src="/assets/home-architecture.jpg"
        alt="Illustrative contemporary architecture in a tree-lined setting"
        fill
        sizes="1376px"
        unoptimized
        className="home-cover"
        data-asset-slot="closing-photo"
      />
      <div className="home-photo-overlay" />
      <div className="home-closing-copy">
        <h2 id="closing-title" className="text-home-section">
          A new chapter starts
        </h2>
        <p className="font-editorial text-home-serif italic">with a doorway.</p>
        <HomeLink href="/properties" variant="accent" className="home-view-cta">
          Explore homes ↗
        </HomeLink>
      </div>
    </section>
  );
}
