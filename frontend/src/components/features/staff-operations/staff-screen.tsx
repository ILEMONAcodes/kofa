"use client";

import { useLocalAccess } from "@/components/access/local-access";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";
import { actionButtonVariant } from "@/lib/action-presentation";
import { Button } from "@/components/common/button";
import { Dropdown } from "@/components/common/dropdown";
import { Input } from "@/components/common/input";
import { Modal } from "@/components/common/modal";
import { SearchBudget } from "@/components/browse/search-budget";
import { parseMoneyInput } from "@/lib/formatters/money";
import {
  visibleRecordText,
  mediaError,
  previewDestination,
  staffOptions,
  staffPath,
  staffScreens,
  type StaffBlock,
} from "./model";

import {
  administrationDestination,
  administrationFields,
  administrationLists,
  administrationOptions,
  administrationPath,
  administrationScreens,
  administrationSections,
  validateAdministrationMoney,
} from "@/components/features/administration/model";

const tone: Record<string, string> = {
  primary: "rgb(var(--primary))",
  muted: "rgb(var(--muted))",
  ink: "rgb(var(--ink))",
  inverse: "rgb(var(--inverse))",
  surface: "rgb(var(--surface))",
  tint: "rgb(var(--primary-tint))",
  dark: "rgb(var(--primary-hover))",
};
export function StaffScreen({
  slug,
  administration = false,
}: {
  slug: string;
  administration?: boolean;
}) {
  const { role, leave } = useLocalAccess();
  const screens = administration ? administrationScreens : staffScreens;
  const path = administration ? administrationPath : staffPath;
  const sections = administration
    ? administrationSections
    : [
        "overview",
        "properties",
        "landlords",
        "inquiries",
        "clients",
        "inspections",
        "calendar",
      ];
  const directoryLabel = administration
    ? "Administration tools"
    : "Workspace tools";
  const listSlugs = administration
    ? administrationLists
    : ["properties", "landlords", "inquiries", "clients", "inspections"];
  const screen = screens.find((item) => item.slug === slug)!;
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<"menu" | "service" | null>(null);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const get = (block: StaffBlock) =>
    values[block.id] ?? (block.value ?? "").replace(/\s*▾$/, "");
  const update = (id: string, value: string) =>
    setValues((previous) => ({ ...previous, [id]: value }));
  function unavailable(label: string) {
    setOperation(label);
    setDialog("service");
  }
  function action(block: StaffBlock, context: string) {
    const label = block.text ?? "Continue";
    if (/sign out/i.test(label)) {
      leave();
      router.push("/staff/login");
      return;
    }
    if (label === "Add photo") {
      photoInput.current?.click();
      return;
    }
    if (label === "Replace video") {
      videoInput.current?.click();
      return;
    }
    if (label === "Refresh messages") {
      setNotice(
        "Messaging is currently unavailable. Your conversation has not changed.",
      );
      return;
    }
    if (!administration && label === "Review status change") {
      const field = screen.blocks.find((item) => item.label === "Action");
      if (field && get(field) !== "Unpublish") {
        unavailable(get(field));
        return;
      }
    }
    const next = administration
      ? administrationDestination(slug, label, context)
      : previewDestination(slug, label, context);
    if (
      administration &&
      (!next || /^(Review|Create|Record|Save|Send|Confirm)/.test(label))
    ) {
      if (!form.current?.reportValidity()) return;
      const issue = validateAdministrationMoney(screen.blocks, values);
      if (issue) {
        setError(issue);
        return;
      }
      setError("");
    }
    if (next) {
      router.push(next.startsWith("/") ? next : path(next));
      return;
    }
    if (
      /save|record|send|confirm|remove|refresh document/i.test(label) &&
      !form.current?.reportValidity()
    )
      return;
    if (slug === "qualification") {
      const budgets: StaffBlock[] = [];
      function collect(blocks: StaffBlock[]) {
        blocks.forEach((item) => {
          if (item.type === "budget") budgets.push(item);
          if (item.children) collect(item.children);
        });
      }
      collect(screen.blocks);
      try {
        const amounts = budgets.map((item) =>
          parseMoneyInput(get(item).replace("₦", "")),
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
    unavailable(label);
  }
  function isListRecord(block: StaffBlock) {
    return (
      !!block.children?.some(
        (child) => child.type === "action" && child.text === "Open record →",
      ) || !!(administration && slug === "audit" && block.border)
    );
  }
  function matches(block: StaffBlock) {
    if (!isListRecord(block)) return true;
    if (!listSlugs.includes(slug)) return true;
    const text = visibleRecordText(block).toLowerCase();
    const filters = administration
      ? administrationFields(screen.blocks)
      : screen.blocks.filter((item) => item.type === "field");
    return filters.every((field) => {
      const selected = values[field.id];
      if (
        !selected ||
        selected === (field.value ?? "").replace(/\s*▾$/, "") ||
        /^(all |my queue|other|this week|next week)/i.test(selected)
      )
        return true;
      if (field.label === "Date range") return selected !== "Today";
      return text.includes(selected.toLowerCase());
    });
  }
  function field(block: StaffBlock) {
    const label = block.label ?? "Preference";
    const value = get(block);
    const search = /^Search/.test(label);
    const isDate = label === "Date" || label === "Move-in target";
    const isDateTime = /Received at|Confirmed at/.test(label);
    const dropdown = block.select;
    let options =
      (administration
        ? (administrationOptions[label] ?? staffOptions[label])
        : staffOptions[label]) ?? [];
    if (administration && label === "Role" && slug !== "users")
      options = ["Staff", "Admin"];
    if (administration && label === "Category" && slug === "edit-article")
      options = ["Verification", "Fees", "Inspections", "General"];
    if (!administration && label === "Status")
      options =
        slug === "properties"
          ? [
              "Submitted / In review",
              "Submitted",
              "In review",
              "Published",
              "Unpublished",
            ]
          : [
              "All statuses",
              "Awaiting confirmation",
              "Confirmed",
              "Completed",
              "Cancelled",
            ];
    const original = (block.value ?? "").replace(/\s*▾$/, "");
    const choices = Array.from(new Set([original, ...options, "Other"])).map(
      (option) => ({ value: option, label: option }),
    );
    return (
      <div className="staff-field" key={block.id}>
        {block.type === "textarea" ? (
          <>
            <label htmlFor={block.id}>{label}</label>
            <textarea
              id={block.id}
              value={value}
              onChange={(event) => update(block.id, event.target.value)}
              required={!/optional/i.test(label)}
              maxLength={
                administration && label === "Article body" ? undefined : 4000
              }
            />
          </>
        ) : dropdown ? (
          <>
            <Dropdown
              chevronAsset={block.chevron ?? undefined}
              label={label}
              id={block.id}
              value={value}
              options={choices}
              onChange={(event) => update(block.id, event.target.value)}
            />
            {value === "Other" && (
              <Input
                label={`Specify ${label.toLowerCase()}`}
                value={values[block.id + ":other"] ?? ""}
                onChange={(event) =>
                  update(block.id + ":other", event.target.value)
                }
                required
              />
            )}
          </>
        ) : (
          <Input
            className={administration ? "placeholder:text-ink" : undefined}
            label={label}
            id={block.id}
            type={
              isDate
                ? "date"
                : isDateTime
                  ? "datetime-local"
                  : administration && label === "Email"
                    ? "email"
                    : label === "Display order"
                      ? "number"
                      : "text"
            }
            min={label === "Display order" ? 1 : undefined}
            inputMode={
              /^(Price|Agreed price|Amount)/.test(label) ? "decimal" : undefined
            }
            placeholder={search ? original : undefined}
            value={
              search
                ? (values[block.id] ?? "")
                : isDate
                  ? (values[block.id] ??
                    (label === "Date" ? "2026-11-03" : "2026-12-01"))
                  : isDateTime
                    ? (values[block.id] ??
                      (/^Received at/.test(label)
                        ? administration
                          ? "2026-10-26T09:00"
                          : "2026-10-27T09:00"
                        : "2026-10-26T09:41"))
                    : value
            }
            onChange={(event) => update(block.id, event.target.value)}
          />
        )}
      </div>
    );
  }
  function render(block: StaffBlock, context = ""): React.ReactNode {
    if (!matches(block)) return null;
    if (block.type === "text") {
      const style: CSSProperties = {
        whiteSpace:
          administration && block.text?.includes("  ") ? "pre-wrap" : undefined,
        fontSize: block.size,
        lineHeight: `${block.line}px`,
        fontWeight: block.weight,
        color: tone[block.tone ?? "ink"],
      };
      if (block.id === screen.blocks[1].id)
        return (
          <h1 key={block.id} style={style}>
            {block.text}
          </h1>
        );
      if (block.size === 24)
        return (
          <h2 key={block.id} style={style}>
            {block.text}
          </h2>
        );
      return (
        <p key={block.id} style={style}>
          {block.text}
        </p>
      );
    }
    if (block.type === "field" || block.type === "textarea")
      return field(block);
    if (block.type === "budget")
      return (
        <SearchBudget
          key={block.id}
          label={block.label!}
          value={get(block).replace("₦", "")}
          onChange={(value) => update(block.id, value)}
        />
      );
    if (block.type === "image")
      return (
        <Image
          key={block.id}
          data-source-node={block.id}
          className="staff-photo"
          src={block.src!}
          width={350}
          height={block.height!}
          style={{ height: block.height, borderRadius: block.radius }}
          alt={
            block.src?.includes("architecture")
              ? "Property exterior"
              : block.src?.includes("jabi")
                ? "Jabi property interior"
                : "Living room"
          }
        />
      );
    if (block.type === "divider")
      return <hr key={block.id} className="staff-divider" />;
    if (block.type === "badge")
      return (
        <span key={block.id} className="staff-badge">
          {block.text}
        </span>
      );
    if (block.type === "action") {
      if (block.text === "View public listing")
        return (
          <Link
            key={block.id}
            href="/properties/3-bedroom-flat-wuse-2"
            className="staff-public-link"
          >
            {block.text}
          </Link>
        );
      return (
        <Button
          key={block.id}
          variant={actionButtonVariant(block.text ?? "", block.variant)}
          className="w-full"
          onClick={() => action(block, context)}
        >
          {block.text}
        </Button>
      );
    }
    const style: CSSProperties = {
      display: "flex",
      flexDirection: block.row ? "row" : "column",
      gap: block.gap,
      padding: block.padding,
      borderRadius: block.radius,
      border: block.border ? "1px solid rgb(var(--border))" : undefined,
      background: tone[block.tone ?? "none"],
    };
    return (
      <div
        key={block.id}
        style={style}
        className={`staff-group${block.name === "Timeline marker" ? " staff-timeline-marker" : ""}${context === "Week calendar" ? " staff-calendar-row" : ""}${block.name === "Photo previews" ? " staff-photo-row" : ""}`}
        data-source-node={block.id}
      >
        {block.children?.map((child) => render(child, block.name || context))}
      </div>
    );
  }
  const empty =
    listSlugs.includes(slug) &&
    !screen.blocks.some((block) => isListRecord(block) && matches(block));
  return (
    <main id="main-content" className="journey-screen staff-preview">
      <header className="journey-header">
        <p>Kof’a workspace</p>
        <div>
          <Link href={staffPath("overview")} aria-label="Kof’a staff overview">
            <Image
              src="/assets/client-logo.svg"
              width={101}
              height={33}
              alt="Kof’a"
              className="staff-brand"
            />
          </Link>
          <Button variant="subtle" onClick={() => setDialog("menu")}>
            Menu
          </Button>
        </div>
      </header>
      <div className="journey-scroll">
        <form
          ref={form}
          className="journey-body"
          onSubmit={(event) => event.preventDefault()}
        >
          {screen.blocks.map((block) => render(block))}
          {empty && (
            <p role="status">
              No records match these filters. Clear the filters to see the
              examples.
            </p>
          )}
          {slug === "media" && (
            <section
              aria-label="Local media selection"
              className="staff-selected-media"
            >
              <p>Selected files stay on this device; nothing is uploaded.</p>
              {photos.map((photo, index) => (
                <div key={`${photo.name}-${index}`}>
                  <p>{photo.name}</p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setPhotos((previous) =>
                        previous.filter((_, position) => position !== index),
                      )
                    }
                  >
                    Remove selected photo {index + 1}
                  </Button>
                </div>
              ))}
              {video && (
                <div>
                  <p>{video.name}</p>
                  <Button variant="secondary" onClick={() => setVideo(null)}>
                    Clear selected video
                  </Button>
                </div>
              )}
            </section>
          )}
          <p role="alert" className="text-danger">
            {error}
          </p>
          <p role="status">{notice}</p>
          <Button variant="secondary" onClick={() => setDialog("menu")}>
            {directoryLabel}
          </Button>
        </form>
      </div>
      <nav aria-label="Staff mobile navigation" className="journey-nav">
        {[
          ["Overview", "overview", "home"],
          ["Properties", "properties", "search"],
          ["Inquiries", "inquiries", "inquiries"],
        ].map(([label, target, icon]) => (
          <Link key={target} href={staffPath(target)}>
            <Image
              src={`/assets/mobile-${icon}.svg`}
              width={22}
              height={22}
              alt=""
            />
            {label}
          </Link>
        ))}
        <button type="button" onClick={() => setDialog("menu")}>
          <Image
            src="/assets/mobile-account-active.svg"
            width={22}
            height={22}
            alt=""
          />
          Menu
        </button>
      </nav>
      <input
        ref={photoInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        aria-label="Choose property photos"
        onChange={(event) => {
          const next = [...photos, ...Array.from(event.target.files ?? [])];
          const issue = mediaError(
            [
              ...Array.from({ length: 3 }, () => ({
                type: "image/jpeg",
                size: 0,
              })),
              ...next,
            ],
            "photo",
          );
          if (issue) setError(issue);
          else {
            setPhotos(next);
            setError("");
            setNotice(
              `${next.length} local photo${next.length === 1 ? "" : "s"} selected. Not uploaded.`,
            );
          }
          event.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/mp4,video/webm"
        hidden
        aria-label="Choose property video"
        onChange={(event) => {
          const next = Array.from(event.target.files ?? []);
          const issue = mediaError(next, "video");
          if (issue) setError(issue);
          else {
            setVideo(next[0] ?? null);
            setError("");
            setNotice("Local video selected. Not uploaded.");
          }
          event.target.value = "";
        }}
      />
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === "menu"
            ? administration
              ? "Administration"
              : "Staff workspace"
            : "Action unavailable"
        }
      >
        {dialog === "menu" ? (
          <div>
            <nav
              aria-label="Workspace sections"
              className="staff-menu-sections"
            >
              <Link href="/verification/checks">
                Verification &amp; publication
              </Link>
              <Link href="/review/staff-review">
                Review property submission
              </Link>
              {sections.map((target) => (
                <Link key={target} href={path(target)}>
                  {target[0].toUpperCase() +
                    target.slice(1).replaceAll("-", " ")}
                </Link>
              ))}
              {!administration && role === "admin" && (
                <Link href={administrationPath("administration")}>
                  Administration & support
                </Link>
              )}
              {administration && (
                <Link href={staffPath("overview")}>Staff operations</Link>
              )}
            </nav>
          </div>
        ) : (
          <>
            <p className="mb-4">
              {operation === "Play walkthrough"
                ? "A video walkthrough is not available for this property."
                : "This action is currently unavailable. Nothing was submitted or changed."}
            </p>
            <Link className="staff-public-link" href="/resources/help">
              Get help
            </Link>
          </>
        )}
      </Modal>
    </main>
  );
}
