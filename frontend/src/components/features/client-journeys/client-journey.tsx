"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useLocalAccess } from "@/components/access/local-access";
import { illustrativeListings } from "@/components/browse/home-content";
import { listingPrice } from "@/lib/property-presentation";
import Image from "next/image";
import { parseMoneyInput } from "@/lib/formatters/money";
import { useState } from "react";
import { actionButtonVariant } from "@/lib/action-presentation";
import { Button } from "@/components/common/button";
import { Modal } from "@/components/common/modal";
import { SearchBudget } from "@/components/browse/search-budget";
import data from "./screens.json";

type Block = {
  id: string;
  name: string;
  type: string;
  text?: string;
  label?: string;
  value?: string;
  size?: number;
  line?: number;
  weight?: number;
  tone?: string;
  gap?: number;
  padding?: number;
  radius?: number;
  row?: boolean;
  border?: boolean;
  variant?: string;
  children?: Block[];
};
export const clientScreens = data;
const path = (slug: string) => `/account/${slug}`;
const options: Record<string, string[]> = {
  "Request type": ["Express interest", "Request inspection"],
  "Filter status": ["All inquiries", "Awaiting team reply", "In progress"],
  "Preferred time (WAT)": [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "14:00",
    "15:00",
  ],
  "Complaint kind": ["Service complaint", "Property concern"],
  "Related to": ["My appointment — APT000123", "My inquiry — INQ000123"],
};
export function ClientJourney({ slug }: { slug: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const access = useLocalAccess();
  const selected = illustrativeListings.find(
    (item) => item.slug === params.get("property"),
  );
  const screen: { slug: string; id: string; blocks: Block[] } = data.find(
    (item) => item.slug === slug,
  )!;
  const [values, setValues] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<"help" | "service" | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function destination(label: string, context: string) {
    const text = `${label} ${context}`.toLowerCase();
    if (/open record/i.test(label)) {
      if (slug === "notifications") return "notification-detail";
      if (/^APT/i.test(context)) return "inspection-review";
      if (/^TXN/i.test(context)) return "transaction-detail";
      if (/^CMP/i.test(context)) return "complaint-detail";
    }
    if (/express interest|request inspection/i.test(label)) return "inquiry";
    if (/general inquiry/i.test(label)) return "general-inquiry";
    if (/back to conversation|open conversation/i.test(label))
      return "conversation";
    if (/reschedule/.test(text)) return "reschedule";
    if (/cancel.*visit|cancel inspection/.test(text)) return "cancel-visit";
    if (/file.*complaint|submit.*concern/.test(text)) return "complaint-form";
    if (/notification|latest updates/.test(text)) return "notifications";
    if (/complaint|case/.test(text))
      return /open record/.test(text) ? "complaint-detail" : "complaints";
    if (/agreement|transaction|terms/.test(text))
      return /open record|active agreement/.test(text)
        ? "transaction-detail"
        : "transactions";
    if (/inspection|appointment|visit/.test(text))
      return /open record|view appointment|view inspection/.test(text)
        ? "inspection-review"
        : "inspections";
    if (/conversation|open inquiry|open record/.test(text))
      return "conversation";
    if (/general inquiry/.test(text)) return "general-inquiry";
    if (/express interest|request inspection/.test(text)) return "inquiry";
    if (/inquir/.test(text)) return "inquiries";
    return "overview";
  }
  function action(label: string, context: string) {
    const form = document.querySelector<HTMLFormElement>(".journey-body");
    if (/send|submit|confirm/i.test(label) && form && !form.reportValidity())
      return;
    if (/send inquiry/i.test(label)) {
      const budgets: Block[] = [];
      const collect = (blocks: Block[]) =>
        blocks.forEach((block) => {
          if (block.type === "budget") budgets.push(block);
          if (block.children) collect(block.children);
        });
      collect(screen.blocks);
      try {
        const amounts = budgets.map((block) =>
          parseMoneyInput(
            values[block.id] ?? (block.value ?? "").replace("₦", ""),
          ),
        );
        if (
          amounts.length === 2 &&
          amounts[0] !== null &&
          amounts[1] !== null &&
          amounts[0] > amounts[1]
        ) {
          setError("Minimum budget must not exceed maximum budget.");
          return;
        }
      } catch {
        setError("Enter valid budget amounts.");
        return;
      }
    }
    setError("");
    if (/sign out/i.test(label)) {
      void access.leave().then(()=>window.location.replace("/")).catch(()=>setDialog("service"));
      return;
    }
    if (/refresh/i.test(label)) {
      setNotice(
        "Messaging is currently unavailable. Your conversation has not changed.",
      );
      return;
    }
    if (/send|submit|confirm|sign out|mark .*read/i.test(label)) {
      setDialog("service");
      return;
    }
    if (/reporting works|fee|help/i.test(label)) {
      setDialog("help");
      return;
    }
    router.push(path(destination(label, context)));
  }
  function render(block: Block, context = ""): React.ReactNode {
    if (
      slug === "inquiry" &&
      selected &&
      block.type === "action" &&
      block.text === "Back to property"
    )
      return (
        <Link
          key={block.id}
          className="journey-link"
          href={`/properties/${selected.slug}`}
        >
          Back to property
        </Link>
      );
    if (slug === "inquiries" && block.name.startsWith("INQ-")) {
      const filter = screen.blocks.find(
        (item) => item.label === "Filter status",
      );
      const selected = filter ? values[filter.id] : undefined;
      const content = JSON.stringify(block).toLowerCase();
      if (
        selected &&
        selected !== "All inquiries" &&
        selected !== "Other" &&
        !content.includes(selected.toLowerCase())
      )
        return null;
    }
    const label = block.label ?? "";
    const current =
      values[block.id] ?? (block.value ?? "").replace(/\s*▾$/, "");
    const update = (value: string) =>
      setValues((previous) => ({ ...previous, [block.id]: value }));
    if (slug === "inquiry" && block.name === "Managed by Kof’a" && selected)
      return (
        <section
          key={block.id}
          className="rounded-xl border bg-surface p-4 space-y-3"
        >
          <Image
            src={selected.image}
            alt={selected.alt}
            width={600}
            height={360}
            className="rounded-lg"
          />
          <h2>{selected.title}</h2>
          <p>{listingPrice(selected.price)}</p>
          <p>{selected.location}</p>
          <Link className="journey-link" href={`/properties/${selected.slug}`}>
            View property
          </Link>
        </section>
      );
    if (block.type === "text") {
      const style = {
        fontSize: block.size,
        lineHeight: `${block.line}px`,
        fontWeight: block.weight,
        color:
          block.tone === "primary"
            ? "#643b29"
            : block.tone === "muted"
              ? "#6a584d"
              : "#281c16",
      };
      return block.id === screen.blocks[1].id ? (
        <h1 key={block.id} style={style}>
          {block.text}
        </h1>
      ) : (
        <p key={block.id} style={style}>
          {block.text}
        </p>
      );
    }
    if (block.type === "budget")
      return (
        <SearchBudget
          key={block.id}
          label={label}
          value={values[block.id] ?? current.replace("₦", "")}
          onChange={update}
        />
      );
    if (block.type === "field" || block.type === "textarea") {
      const dropdown = block.value?.includes("▾") || options[label];
      const choices = Array.from(
        new Set([current, ...(options[label] ?? []), "Other"]),
      ).filter(Boolean);
      return (
        <div key={block.id} className="journey-field">
          <label htmlFor={block.id}>{label}</label>
          {block.type === "textarea" ? (
            <textarea
              id={block.id}
              value={
                values[block.id] ??
                (/^Describe what|^Tell us|^Tuesday morning|^Please move|^My plans/.test(
                  block.value ?? "",
                )
                  ? ""
                  : current)
              }
              placeholder={block.value}
              onChange={(event) => update(event.target.value)}
              maxLength={/outcome/i.test(label) ? 500 : 4000}
              required={!/optional/i.test(label)}
              minLength={label === "Description" ? 20 : 1}
            />
          ) : dropdown ? (
            <select
              id={block.id}
              value={current}
              onChange={(event) => update(event.target.value)}
            >
              {choices.map((choice) => (
                <option key={choice}>{choice}</option>
              ))}
            </select>
          ) : (
            <input
              id={block.id}
              type={/date/i.test(label) ? "date" : "text"}
              value={
                /date/i.test(label)
                  ? (values[block.id] ??
                    (block.value === "01 December 2026"
                      ? "2026-12-01"
                      : block.value === "05 November 2026"
                        ? "2026-11-05"
                        : ""))
                  : current
              }
              onChange={(event) => update(event.target.value)}
            />
          )}
          {current === "Other" && (
            <input
              aria-label={`Specify ${label.toLowerCase()}`}
              placeholder="Specify your preference"
              required
            />
          )}
        </div>
      );
    }
    if (block.type === "image")
      return (
        <Image
          key={block.id}
          width={350}
          height={220}
          src="/assets/home-living-room.jpg"
          alt="Living room in Wuse 2"
          className="journey-photo"
        />
      );
    if (block.type === "badge")
      return (
        <span key={block.id} className="journey-badge">
          {block.text || "Optional"}
        </span>
      );
    if (block.type === "action") {
      const text = block.text ?? "Continue";
      if (/evidence/i.test(text))
        return (
          <div key={block.id}>
            <label className="journey-upload">
              Add evidence
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                onChange={(event) => {
                  const next = [
                    ...files,
                    ...Array.from(event.target.files ?? []),
                  ];
                  if (
                    next.length > 3 ||
                    next.some(
                      (file) =>
                        file.size > 5 * 1024 * 1024 ||
                        ![
                          "image/jpeg",
                          "image/png",
                          "application/pdf",
                        ].includes(file.type),
                    )
                  )
                    setError(
                      "Choose up to three JPEG, PNG or PDF files, each no larger than 5 MB.",
                    );
                  else {
                    setFiles(next);
                    setError("");
                  }
                  event.target.value = "";
                }}
              />
            </label>
            {files.map((file, i) => (
              <Button
                key={`${file.name}-${i}`}
                variant="secondary"
                onClick={() =>
                  setFiles(files.filter((_, position) => position !== i))
                }
              >
                Remove {file.name}
              </Button>
            ))}
          </div>
        );
      const href = /log in/i.test(text)
        ? "/login"
        : /explore|browse homes|find a property/i.test(text)
          ? "/properties"
          : /back to property/i.test(text)
            ? "/properties/3-bedroom-flat-wuse-2"
            : null;
      return href ? (
        <Link key={block.id} className="journey-link" href={href}>
          {text}
        </Link>
      ) : (
        <Button
          key={block.id}
          className="w-full"
          variant={actionButtonVariant(block.text ?? "", block.variant)}
          onClick={() => action(text, context)}
        >
          {text}
        </Button>
      );
    }
    return (
      <div
        key={block.id}
        data-source-node={block.id}
        style={{
          width: block.name === "Timeline marker" ? 32 : undefined,
          flex: block.name === "Timeline marker" ? "0 0 32px" : undefined,
          display: "flex",
          flexDirection: block.row ? "row" : "column",
          gap: block.gap,
          padding: block.padding,
          borderRadius: block.radius,
          border: block.border ? "1px solid #ded3c9" : undefined,
          background:
            block.tone === "surface"
              ? "#fff"
              : block.tone === "tint"
                ? "#f0e7de"
                : undefined,
        }}
        className="journey-group"
      >
        {block.children?.map((child) => render(child, block.name || context))}
      </div>
    );
  }
  return (
    <main id="main-content" className="journey-screen">
      <header className="journey-header">
        <p>The doorway to your home</p>
        <div>
          <Link href={path("overview")} aria-label="Kof’a account overview">
            <Image
              src="/assets/client-logo.svg"
              width="105"
              height="35"
              alt="Kof’a"
            />
          </Link>
          <Button
            variant="secondary"
            onClick={() => router.push(path("overview"))}
          >
            Back
          </Button>
          <Button variant="secondary" onClick={() => setDialog("help")}>
            Help
          </Button>
        </div>
      </header>
      <div className="journey-scroll">
        <form
          className="journey-body"
          onSubmit={(event) => event.preventDefault()}
        >
          {screen.blocks.map((block) => render(block))}
          {(slug === "transaction-detail" || slug === "transactions") && (
            <Link href="/verification/agreement" className="journey-link">
              Agreement and completion timeline
            </Link>
          )}
          <p role="alert">{error}</p>
          <p role="status">{notice}</p>
          <nav className="account-sections" aria-label="Account sections">
            {[
              "overview",
              "inquiries",
              "inspections",
              "transactions",
              "complaints",
              "notifications",
            ].map((item) => (
              <Link key={item} href={path(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </Link>
            ))}
          </nav>
        </form>
      </div>
      <nav aria-label="Mobile navigation" className="journey-nav">
        {[
          ["Home", "/", "home"],
          ["Explore", "/properties", "search"],
          ["Inquiries", path("inquiries"), "inquiries"],
          ["Account", path("overview"), "account"],
        ].map(([name, href, icon]) => (
          <Link key={name} href={href}>
            <Image
              src={`/assets/mobile-${icon}${(icon === "inquiries" && ["inquiries", "conversation", "message-sent"].includes(slug)) || (icon === "account" && !["inquiries", "conversation", "message-sent"].includes(slug)) ? "-active" : ""}.svg`}
              width="22"
              height="22"
              alt=""
            />
            {name}
          </Link>
        ))}
      </nav>
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === "help" ? "Help with your next step" : "Action unavailable"
        }
      >
        {
          <>
            <p>
              {dialog === "help"
                ? "Support is currently unavailable. Please try again later."
                : "This action is currently unavailable. Nothing was submitted or changed."}
            </p>
            {dialog === "service" && (
              <Link className="journey-link" href="/resources/help">
                Get help
              </Link>
            )}
          </>
        }
      </Modal>
    </main>
  );
}
