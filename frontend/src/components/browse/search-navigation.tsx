/* eslint-disable @next/next/no-img-element -- Preserve fractional dimensions of the exported Figma vector. */
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/app-shell";
import { HomeLink } from "./home-link";
import { buttonStyles } from "@/components/common/button";
export function SearchNavigation({
  detail = false,
  assistantHref = "/contact?topic=assistant",
}: {
  detail?: boolean;
  assistantHref?: string;
}) {
  return (
    <>
      <MobileHeader back={detail ? "/properties" : undefined} />
      <header
        className="search-navigation-surround"
        data-node-id={detail ? "28:826" : "28:781"}
      >
        <div
          className="search-navigation"
          data-node-id={detail ? "28:827" : "28:782"}
        >
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
            <Link href="/properties" aria-current={detail ? undefined : "page"}>
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
          {assistantHref.startsWith("#") ? (
            <a
              href={assistantHref}
              className={buttonStyles("secondary", "home-nav-ask")}
            >
              Ask Kof’a
            </a>
          ) : (
            <HomeLink href={assistantHref} className="home-nav-ask">
              Ask Kof’a
            </HomeLink>
          )}
        </div>
      </header>
    </>
  );
}
