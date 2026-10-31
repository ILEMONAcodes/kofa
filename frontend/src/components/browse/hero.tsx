/* eslint-disable @next/next/no-img-element -- Keep Figma SVG exports at their exact fractional intrinsic dimensions. */
import Image from "next/image";
import Link from "next/link";
import { HomeLink } from "./home-link";
export function Hero() {
  return (
    <section
      className="home-hero"
      data-node-id="28:580"
      aria-label="The doorway to your next chapter"
    >
      <Image
        src="/assets/home-architecture.jpg"
        alt="contemporary home surrounded by trees at dusk"
        fill
        priority
        unoptimized
        sizes="1376px"
        className="home-cover"
        data-asset-slot="hero"
      />
      <div className="home-photo-overlay" />
      <header className="home-navigation">
        <Link href="/" aria-label="Kof’a home" className="home-header-logo">
          <img
            src="/assets/home-logo-header.svg"
            width="144.5"
            height="46.8333"
            alt="Kof’a"
            data-asset-slot="header-logo"
          />
        </Link>
        <div className="home-nav-spacer" />
        <nav aria-label="Main navigation" className="home-navigation-pill">
          <Link href="/properties">Find a property</Link>
          <a href="#how-it-works">How it works</a>
          <Link href="/list-your-property">List your property</Link>
        </nav>
        <div className="home-nav-spacer" />
        <HomeLink
          href="/list-your-property"
          variant="accent"
          className="home-nav-list"
        >
          List a property ↗
        </HomeLink>
        <HomeLink href="/login" className="home-nav-login">
          Log in
        </HomeLink>
        <HomeLink href="/contact?topic=assistant" className="home-nav-ask">
          Ask Kof’a
        </HomeLink>
      </header>
      <p className="home-wordmark" aria-hidden="true">
        KOF’A
      </p>
      <div className="home-hero-copy">
        <h1 className="text-home-section">The doorway to</h1>
        <p className="font-editorial text-home-serif italic">
          your next chapter.
        </p>
        <p className="home-hero-description">
          Verified properties. Clearer information. A team beside you.
        </p>
        <HomeLink href="/properties" variant="accent" className="home-hero-cta">
          Explore properties ↗
        </HomeLink>
      </div>
      <aside className="home-trust-label">
        <h2 className="text-home-card text-primary">
          A little more certainty.
        </h2>
        <p className="text-sm text-muted">
          See what was checked, when it was checked, and what happens next.
        </p>
      </aside>
    </section>
  );
}
