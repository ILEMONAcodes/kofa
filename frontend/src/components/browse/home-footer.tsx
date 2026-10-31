/* eslint-disable @next/next/no-img-element -- Preserve the exact intrinsic size of the Figma SVG export. */
import Link from "next/link";
import { HomeLink } from "./home-link";
export function HomeFooter({
  showHelpActions = true,
  nodeId = "28:761",
}: {
  showHelpActions?: boolean;
  nodeId?: string;
}) {
  return (
    <footer className="home-footer" data-node-id={nodeId}>
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
            <Link href="/resources/help">Speak to our team</Link>
          </div>
        </nav>
        <nav aria-label="Trust and information">
          <h2 className="text-home-caption text-accent">GOOD TO KNOW</h2>
          <div className="home-footer-column">
            <p>
              <Link href="/resources/verification">Verification</Link> ·{" "}
              <Link href="/resources/fees">Fees</Link> ·{" "}
              <Link href="/resources/privacy">Privacy</Link>
            </p>
            <p>
              <Link href="/resources/terms">Terms</Link> ·{" "}
              <Link href="/resources/report">Report a listing</Link>
            </p>
            <Link href="/staff/login">Staff sign in</Link>
          </div>
        </nav>
      </div>
      <p className="text-home-caption text-accent">THE DOORWAY TO YOUR HOME</p>
      <p className="text-home-footer-wordmark" aria-hidden="true">
        KOF’A
      </p>
      <p className="text-home-caption">Find a place to call your own.</p>
      {showHelpActions && (
        <nav className="home-footer-actions" aria-label="Help and contact">
          <HomeLink href="/resources/help" variant="accent">
            Speak to our team
          </HomeLink>
          <HomeLink href="/resources/terms" variant="secondary">
            Help &amp; policies
          </HomeLink>
          <HomeLink href="/resources/assistant" variant="secondary">
            AI support
          </HomeLink>
        </nav>
      )}
    </footer>
  );
}
