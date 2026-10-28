import Image from "next/image";
import { HomeLink } from "./home-link";
export function HomeTrust() {
  return (
    <section
      className="home-trust"
      data-node-id="28:732"
      aria-labelledby="trust-title"
    >
      <div className="home-trust-photo">
        <Image
          src="/assets/home-living-room.jpg"
          alt="Illustrative living room with natural light and warm wood finishes"
          fill
          sizes="560px"
          unoptimized
          className="home-cover"
          data-asset-slot="trust-photo"
        />
      </div>
      <div className="home-trust-copy">
        <h2 id="trust-title" className="text-home-section">
          Beautiful spaces.
        </h2>
        <p className="font-editorial text-home-serif italic text-primary">
          Honest information.
        </p>
        <p className="home-trust-body text-muted">
          A badge should tell you something useful. Every verified listing
          explains its checks and the date they were completed.
        </p>
        <aside className="home-verification-note">
          <h3 className="text-sm font-medium text-primary">Know the limits</h3>
          <p className="text-sm text-muted">
            Verification confirms the checks listed. It is not a guarantee of
            legal title.
          </p>
        </aside>
        <HomeLink href="/verification" className="home-verification-cta">
          Understand verification ↗
        </HomeLink>
      </div>
    </section>
  );
}
