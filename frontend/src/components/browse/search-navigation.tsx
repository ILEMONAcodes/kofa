/* eslint-disable @next/next/no-img-element -- Preserve fractional dimensions of the exported Figma vector. */
import Link from "next/link";
import { HomeLink } from "./home-link";
export function SearchNavigation() {
  return (
    <header className="search-navigation-surround" data-node-id="28:781">
      <div className="search-navigation" data-node-id="28:782">
        <Link href="/" className="home-header-logo" aria-label="Kof’a home">
          <img
            src="/assets/search-logo-header.svg"
            width="144.5"
            height="46.8333"
            alt="Kof’a"
          />
        </Link>
        <div className="home-nav-spacer" />
        <nav className="home-navigation-pill" aria-label="Main navigation">
          <Link href="/properties" aria-current="page">
            Find a property
          </Link>
          <Link href="/#how-it-works">How it works</Link>
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
      </div>
    </header>
  );
}
