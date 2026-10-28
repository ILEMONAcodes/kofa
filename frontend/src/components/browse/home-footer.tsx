/* eslint-disable @next/next/no-img-element -- Preserve the exact intrinsic size of the Figma SVG export. */
import Link from "next/link";
import { HomeLink } from "./home-link";
export function HomeFooter() {
  return (
    <footer className="home-footer" data-node-id="28:761">
      <div className="home-footer-links">
        <Link href="/" aria-label="Kof’a home" className="home-footer-logo">
          <img
            src="/assets/home-logo-footer.svg"
            width="192.667"
            height="62.4445"
            alt="Kof’a"
            data-asset-slot="footer-logo"
          />
        </Link>
        <nav aria-label="Explore">
          <h2 className="text-home-caption text-accent">EXPLORE</h2>
          <div className="home-footer-column">
            <Link href="/properties">Find a property</Link>
            <Link href="/list-your-property">List your property</Link>
            <Link href="/contact">Speak to our team</Link>
          </div>
        </nav>
        <nav aria-label="Trust and information">
          <h2 className="text-home-caption text-accent">GOOD TO KNOW</h2>
          <div className="home-footer-column">
            <p>
              <Link href="/verification">Verification</Link> ·{" "}
              <Link href="/fees">Fees</Link> ·{" "}
              <Link href="/privacy">Privacy</Link>
            </p>
            <p>
              <Link href="/policies/terms">Terms</Link> ·{" "}
              <Link href="/report">Report a listing</Link>
            </p>
          </div>
        </nav>
      </div>
      <p className="text-home-caption text-accent">THE DOORWAY TO YOUR HOME</p>
      <p className="text-home-footer-wordmark" aria-hidden="true">
        KOF’A
      </p>
      <p className="text-home-caption">
        Design preview · Fictional property data and illustrative stock
        photography.
      </p>
      <nav className="home-footer-actions" aria-label="Help and contact">
        <HomeLink href="/contact">Speak to our team</HomeLink>
        <HomeLink href="/policies/terms">Help &amp; policies</HomeLink>
        <HomeLink href="/contact?topic=assistant">AI support</HomeLink>
      </nav>
    </footer>
  );
}
