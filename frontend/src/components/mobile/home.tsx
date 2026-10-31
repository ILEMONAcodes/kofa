"use client";
/* eslint-disable @next/next/no-img-element -- Preserve source SVG dimensions. */
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MobileHeader } from "./app-shell";
import { illustrativeListings } from "@/components/browse/home-content";
import { HomeLink } from "@/components/browse/home-link";
import { MobilePropertyCard } from "./property-card";
export function MobileHome() {
  const [mode, setMode] = useState("rent");
  const href = `/properties?listing_type=${mode}&city=Abuja`;
  return (
    <div className="mobile-only mobile-home" data-mobile-node="14:224">
      <MobileHeader />
      <section className="mobile-discover" aria-label="Discover homes">
        <p className="text-home-caption text-primary">FIND YOUR NEXT CHAPTER</p>
        <h1>A place to</h1>
        <p className="mobile-serif">call your own.</p>
        <Link href={href} className="mobile-search-pill">
          <img
            src="/assets/mobile-search-active.svg"
            width="22"
            height="22"
            alt=""
          />
          <span>Where would you like to live?</span>
        </Link>
        <div className="mobile-rent-buy">
          <button
            aria-pressed={mode === "rent"}
            onClick={() => setMode("rent")}
          >
            Rent
          </button>
          <button
            aria-pressed={mode === "sale"}
            onClick={() => setMode("sale")}
          >
            Buy
          </button>
        </div>
        <div className="mobile-discovery-hero">
          <Image
            src="/assets/home-architecture.jpg"
            alt="Illustrative contemporary home at dusk"
            fill
            priority
            unoptimized
            sizes="350px"
            className="home-cover"
          />
          <div className="home-photo-overlay" />
          <div className="mobile-discovery-copy">
            <h2>
              A little more space.
              <br />A fresh beginning.
            </h2>
            <HomeLink href={href} variant="accent">
              Explore homes ↗
            </HomeLink>
          </div>
        </div>
      </section>
      <section className="mobile-home-properties">
        <h2>Places to make yours</h2>
        <p className="text-sm text-muted">Verified listings · Abuja</p>
        <div className="mobile-card-carousel">
          {illustrativeListings.map((property) => (
            <MobilePropertyCard key={property.slug} property={property} />
          ))}
        </div>
        <HomeLink href={href}>Explore all properties</HomeLink>
        <aside className="mobile-notice">
          <h3>What was checked?</h3>
          <p>
            Every verified listing shows its checks and date. Verification is
            not a guarantee of legal title.
          </p>
        </aside>
        <p className="text-home-caption text-muted">
          Sample properties and stock imagery.
        </p>
        <aside className="mobile-notice">
          <h3>Have a property to list?</h3>
          <p>
            Register your contact details and share your property with our team.
            No landlord account is needed.
          </p>
        </aside>
        <HomeLink href="/list-your-property">List your property</HomeLink>
      </section>
    </div>
  );
}
