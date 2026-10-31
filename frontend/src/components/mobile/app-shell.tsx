"use client";
/* eslint-disable @next/next/no-img-element -- Exact Figma SVG exports at intrinsic dimensions. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceEntry } from "@/components/access/workspace-entry";
import { Modal } from "@/components/common/modal";
export function MobileHeader({ back }: { back?: string }) {
  const [help, setHelp] = useState(false);
  return (
    <header className="mobile-only mobile-header">
      <div className="mobile-brand-bar">
        {back && (
          <Link href={back} aria-label="Back to properties">
            <img src="/assets/mobile-back.svg" width="22" height="22" alt="" />
          </Link>
        )}
        <Link href="/" className="mobile-brand" aria-label="Kof’a home">
          <img
            src="/assets/mobile-logo.svg"
            width="104.04"
            height="33.72"
            alt="Kof’a"
          />
        </Link>
        <span className="mobile-brand-spacer" />
        <span className="mobile-city">Abuja</span>
        <button
          type="button"
          className="mobile-help"
          onClick={() => setHelp(true)}
        >
          Help
        </button>
      </div>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="A little guidance, when you need it."
      >
        <p className="text-muted">
          Find answers about properties, inspections and your next steps.
        </p>
        <Link
          href="/resources/help"
          onClick={() => setHelp(false)}
          className="mt-4 inline-flex min-h-12 items-center text-primary underline"
        >
          Open help centre
        </Link>
        <div>
          <WorkspaceEntry />
        </div>
      </Modal>
    </header>
  );
}
export function MobileAppChrome() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const frame = requestAnimationFrame(() => {
      try {
        if (sessionStorage.getItem("kofa-launch-seen")) {
          setVisible(false);
          return;
        }
        sessionStorage.setItem("kofa-launch-seen", "1");
      } catch {
        /* Entry remains available with restricted storage. */
      }
    });
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const fade = window.setTimeout(() => setLeaving(true), 3000);
    const done = window.setTimeout(
      () => setVisible(false),
      reduced ? 3000 : 3350,
    );
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, []);
  const browse =
    pathname === "/" ||
    pathname === "/properties" ||
    pathname.startsWith("/properties/") ||
    pathname === "/account" ||
    pathname === "/auth-preview/account";
  const items = [
    {
      href: "/",
      label: "Home",
      icon: pathname === "/" ? "mobile-home-active" : "mobile-home",
    },
    {
      href: "/properties",
      label: "Explore",
      icon: pathname.startsWith("/properties")
        ? "mobile-search-active"
        : "mobile-search",
    },
    {
      href: "/account/inquiries",
      label: "Inquiries",
      icon: "mobile-inquiries",
    },
    {
      href: "/account",
      label: "Account",
      icon:
        pathname === "/account" || pathname === "/auth-preview/account"
          ? "mobile-account-active"
          : "mobile-account",
    },
  ];
  return (
    <>
      {browse && (
        <nav
          className="mobile-only mobile-bottom-nav"
          aria-label="App navigation"
        >
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={
                (item.label === "Home" && pathname === "/") ||
                (item.label === "Explore" &&
                  pathname.startsWith("/properties")) ||
                (item.label === "Account" &&
                  (pathname === "/account" ||
                    pathname === "/auth-preview/account"))
                  ? "page"
                  : undefined
              }
            >
              <img
                src={`/assets/${item.icon}.svg`}
                width="22"
                height="22"
                alt=""
              />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
      {visible && (
        <div
          className={`mobile-only mobile-launch${leaving ? " mobile-launch-leaving" : ""}`}
          role="status"
          aria-label="Opening Kof’a"
        >
          <img
            src="/assets/home-logo-footer.svg"
            width="192.667"
            height="62.4445"
            alt="Kof’a"
          />
        </div>
      )}
    </>
  );
}
