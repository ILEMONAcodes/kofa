"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/common/button";
import { Modal } from "@/components/common/modal";
export function InspectionFrame({
  staff,
  children,
  backHref = "/account/inspections",
  homeHref,
  helpTitle = "Help with your visit",
  helpText = "Ask our team in your inquiry conversation for help with your visit. Keep conversations and payments on Kof’a’s approved channels.",
}: {
  staff: boolean;
  children: ReactNode;
  backHref?: string;
  homeHref?: string;
  helpTitle?: string;
  helpText?: string;
}) {
  const [dialog, setDialog] = useState<"menu" | "help" | null>(null);
  const destinations = staff
    ? [
        ["Overview", "/staff/overview"],
        ["Availability review", "/staff/availability-queue"],
        ["Knowledge base", "/staff/knowledge"],
        ["Properties", "/staff/properties"],
        ["Inquiries", "/staff/inquiries"],
        ["Inspections", "/staff/inspections"],
        ["Calendar", "/staff/calendar"],
        ["Complaints", "/staff/complaints"],
        ["Clients", "/staff/clients"],
      ]
    : [
        ["Home", "/"],
        ["Explore", "/properties"],
        ["Inquiries", "/account/inquiries"],
        ["Inspections", "/account/inspections"],
        ["Complaints", "/account/complaints"],
        ["Account", "/account/overview"],
      ];
  return (
    <main
      id="main-content"
      className={`journey-screen inspection-screen${staff ? " inspection-staff" : ""}`}
    >
      <header className="journey-header">
        <p>{staff ? "Kof’a workspace" : "The doorway to your home"}</p>
        <div>
          <Link
            href={homeHref ?? (staff ? "/staff/overview" : "/account/overview")}
            aria-label="Kof’a overview"
            className="inspection-logo"
          >
            <Image
              src="/assets/client-logo.svg"
              width={101.15}
              height={32.7833}
              alt="Kof’a"
            />
          </Link>
          {staff ? (
            <Button variant="subtle" onClick={() => setDialog("menu")}>
              Menu
            </Button>
          ) : (
            <>
              <Link className="inspection-back" href={backHref}>
                Back
              </Link>
              <Button variant="secondary" onClick={() => setDialog("help")}>
                Help
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="journey-scroll inspection-scroll">
        <div className="journey-body inspection-body">{children}</div>
      </div>
      <nav
        aria-label={staff ? "Staff mobile navigation" : "Mobile navigation"}
        className="journey-nav"
      >
        {(staff
          ? [
              ["Overview", "/staff/overview", "home"],
              ["Properties", "/staff/properties", "search"],
              ["Inquiries", "/staff/inquiries", "inquiries"],
            ]
          : [
              ["Home", "/", "home"],
              ["Explore", "/properties", "search"],
              ["Inquiries", "/account/inquiries", "inquiries"],
              ["Account", "/account/overview", "account-active"],
            ]
        ).map(([label, href, icon]) => (
          <Link key={label} href={href}>
            <Image
              src={`/assets/mobile-${icon}.svg`}
              width={22}
              height={22}
              alt=""
            />
            {label}
          </Link>
        ))}
        {staff && (
          <button type="button" onClick={() => setDialog("menu")}>
            <Image
              src="/assets/mobile-account-active.svg"
              width={22}
              height={22}
              alt=""
            />
            Menu
          </button>
        )}
      </nav>
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "help" ? helpTitle : "Workspace"}
      >
        <div className="inspection-stack">
          {dialog === "help" && <p>{helpText}</p>}
          {destinations.map(([name, href]) => (
            <Link key={href} href={href} onClick={() => setDialog(null)}>
              {name}
            </Link>
          ))}
        </div>
      </Modal>
    </main>
  );
}
