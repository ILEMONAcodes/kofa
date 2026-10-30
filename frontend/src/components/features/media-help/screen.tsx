"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { Modal } from "@/components/common/modal";
import { useMediaSession } from "./session";
import {
  destination,
  fieldOptions,
  mediaPath,
  mediaScreens,
  outcome,
  policySlugs,
  type MediaBlock,
} from "./model";
const tones: Record<string, string> = {
  primary: "rgb(var(--primary))",
  muted: "rgb(var(--muted))",
  ink: "rgb(var(--ink))",
  inverse: "rgb(var(--inverse))",
  surface: "rgb(var(--surface))",
  tint: "rgb(var(--primary-tint))",
  dark: "rgb(var(--primary-hover))",
  border: "rgb(var(--border))",
};
export function MediaHelpScreen({ slug }: { slug: string }) {
  const screen = mediaScreens.find((s) => s.slug === slug)!;
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const session = useMediaSession();
  const [values, setValues] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<"menu" | "service" | null>(null);
  const [operation, setOperation] = useState("");
  const [playing, setPlaying] = useState(false);
  const photos = session.media.filter((m) => m.kind === "photo");
  const video = session.media.find((m) => m.kind === "video");
  const isPolicy = policySlugs.includes(slug);
  const go = (target: string) =>
    router.push(target.startsWith("/") ? target : mediaPath(target));
  const update = (id: string, value: string) => {
    setValues((v) => ({ ...v, [id]: value }));
    if (id === "82:2544" || id === "82:3438") session.setCaption(value);
    if (id === "82:2551") {
      const position = Number(value) - 1;
      if (
        Number.isInteger(position) &&
        position >= 0 &&
        position < photos.length
      ) {
        const ordered = [...photos];
        const selected = ordered.shift()!;
        ordered.splice(position, 0, selected);
        session.setMedia([
          ...ordered,
          ...session.media.filter((m) => m.kind !== "photo"),
        ]);
        session.setNotice(
          "Photo order changed locally. The first photo is the cover.",
        );
      }
    }
    if (id === "82:2558" && value !== "Other") {
      const index = ["Living room", "Exterior", "Bedroom"].indexOf(value);
      if (index >= 0 && photos[index]) {
        const selected = photos[index];
        session.setMedia([
          selected,
          ...session.media.filter((m) => m.id !== selected.id),
        ]);
        session.setNotice("Cover photo changed locally.");
      }
    }
  };
  const get = (b: MediaBlock) =>
    values[b.id] ??
    (b.id === "82:2544" || b.id === "82:3438"
      ? session.caption
      : (b.value ?? "")
    ).replace(/\s*▾$/, "");
  function action(label: string, context = "") {
    if (/^(Choose|Add evidence)/.test(label)) {
      session.openManager(slug === "report" ? "report" : "listing");
      return;
    }
    if (label === "Play walkthrough") {
      if (video?.url) {
        setPlaying(true);
        return;
      }
      setOperation(label);
      setDialog("service");
      return;
    }
    if (label === "Use as cover") {
      session.setCaption(values["82:3438"] ?? session.caption);
      session.setNotice(
        "Sample cover and caption saved locally. No listing was updated.",
      );
      go("media");
      return;
    }
    if (label === "Remove and return") {
      session.setMedia(session.media.filter((m) => m.id !== photos[0]?.id));
      session.setNotice("First sample photo removed locally.");
      go("media");
      return;
    }
    if (label === "Remove optional video") {
      session.setMedia(session.media.filter((m) => m.kind !== "video"));
      session.setNotice("Optional local video removed.");
      go("media");
      return;
    }
    const next = destination(slug, label, context);
    if (next) {
      go(next);
      return;
    }
    if (
      ["Submit report", "Send question"].includes(label) &&
      !form.current?.reportValidity()
    )
      return;
    if (label === "Secondary action") {
      go("help");
      return;
    }
    setOperation(label);
    setDialog("service");
  }
  function render(b: MediaBlock, context = ""): ReactNode {
    if (b.type === "text") {
      const style: CSSProperties = {
        fontSize: b.size,
        lineHeight: `${b.line}px`,
        fontWeight: b.weight,
        color: tones[b.tone ?? "ink"],
        whiteSpace: "pre-wrap",
      };
      if (b.id === screen.blocks[1].id)
        return (
          <h1 key={b.id} style={style}>
            {b.text}
          </h1>
        );
      if (b.size === 24)
        return (
          <h2 key={b.id} style={style}>
            {b.text}
          </h2>
        );
      return (
        <p key={b.id} style={style}>
          {b.text}
        </p>
      );
    }
    if (b.type === "skeleton")
      return (
        <div
          key={b.id}
          data-source-node={b.id}
          aria-hidden="true"
          style={{
            height: b.height,
            width: b.name === "Rectangle" ? "70%" : "100%",
            borderRadius: b.radius,
            background: tones[b.tone ?? "tint"],
          }}
        />
      );
    if (b.type === "image") {
      const index = b.id === "82:2529" ? 1 : b.id === "82:2530" ? 2 : 0;
      const changed = slug === "media" && context === "Photo previews";
      if (changed && !photos[index]) return null;
      return (
        <Image
          key={b.id}
          data-source-node={b.id}
          src={changed ? (photos[index].url ?? b.src!) : b.src!}
          width={350}
          height={b.height!}
          unoptimized={changed && photos[index]?.url?.startsWith("blob:")}
          className="staff-photo"
          style={{ height: b.height, borderRadius: b.radius }}
          alt={
            b.src?.includes("architecture")
              ? "Sample property exterior"
              : b.src?.includes("jabi")
                ? "Sample Jabi property interior"
                : "Sample living room"
          }
        />
      );
    }
    if (b.type === "field" || b.type === "textarea") {
      const label = b.label!;
      const placeholder =
        /^(Your |Ask |20–|Enter )/.test(b.value ?? "") && !b.error;
      const value = values[b.id] ?? (placeholder ? "" : get(b));
      const error = b.error
        ? label === "Phone"
          ? "Enter a valid Nigerian phone number."
          : label.includes("Email")
            ? "Enter a valid email address."
            : b.error
        : undefined;
      const fieldError = values[b.id] === undefined ? error : undefined;
      if (b.type === "textarea")
        return (
          <div key={b.id} className="staff-field">
            <label htmlFor={b.id}>{label}</label>
            <textarea
              id={b.id}
              value={value}
              placeholder={placeholder ? b.value : undefined}
              onChange={(e) => update(b.id, e.target.value)}
              minLength={slug === "report" ? 20 : undefined}
              maxLength={slug === "report" ? 2000 : 1000}
              required={slug === "report" || label === "Your question"}
            />
          </div>
        );
      return (
        <div key={b.id} className="staff-field">
          {b.select ? (
            <>
              <Dropdown
                id={b.id}
                label={label}
                value={get(b)}
                options={Array.from(
                  new Set([get(b), ...(fieldOptions[label] ?? []), "Other"]),
                ).map((v) => ({ value: v, label: v }))}
                onChange={(e) => update(b.id, e.target.value)}
              />
              {get(b) === "Other" && (
                <Input
                  label={`Specify ${label.toLowerCase()}`}
                  required
                  value={values[b.id + ":other"] ?? ""}
                  onChange={(e) => update(b.id + ":other", e.target.value)}
                />
              )}
            </>
          ) : (
            <Input
              id={b.id}
              label={label}
              value={value}
              placeholder={placeholder ? b.value : undefined}
              type={
                label.includes("Email")
                  ? "email"
                  : label === "Display order"
                    ? "number"
                    : label.includes("Phone")
                      ? "tel"
                      : "text"
              }
              min={label === "Display order" ? 1 : undefined}
              max={label === "Display order" ? photos.length : undefined}
              disabled={b.disabled}
              error={fieldError}
              className={
                label.includes("Focus example")
                  ? "media-focus-example"
                  : undefined
              }
              onChange={(e) => update(b.id, e.target.value)}
            />
          )}
        </div>
      );
    }
    if (b.type === "action")
      return (
        <Button
          key={b.id}
          disabled={b.disabled}
          className="w-full"
          variant={
            b.variant === "neutral"
              ? "secondary"
              : b.variant === "subtle"
                ? "subtle"
                : "primary"
          }
          onClick={() => action(b.text!, context)}
        >
          {b.text}
        </Button>
      );
    if (b.type === "divider")
      return <hr key={b.id} className="staff-divider" />;
    if (b.type === "badge")
      return (
        <span key={b.id} className="staff-badge">
          {b.text}
        </span>
      );
    const style: CSSProperties = {
      display: "flex",
      flexDirection: b.row ? "row" : "column",
      gap: b.gap,
      padding: b.padding,
      borderRadius: b.radius,
      border: b.border ? "1px solid rgb(var(--border))" : undefined,
      background: tones[b.tone ?? "none"],
    };
    return (
      <div
        key={b.id}
        data-source-node={b.id}
        role={
          isPolicy && b.name === "Draft — awaiting legal review"
            ? "note"
            : undefined
        }
        className={`staff-group ${b.name === "Photo previews" ? "staff-photo-row" : ""}`}
        style={style}
      >
        {b.children?.map((c) => render(c, b.name || context))}
        {b.name === "Video player" && playing && video?.url && (
          <video
            src={video.url}
            controls
            autoPlay={false}
            preload="metadata"
            aria-label="Local walkthrough video"
          />
        )}
      </div>
    );
  }
  return (
    <main
      id="main-content"
      className="journey-screen staff-preview media-help-preview"
    >
      <header className="journey-header">
        <p>Design preview · sample content</p>
        <div>
          <Link href="/" aria-label="Kof’a home">
            <Image
              src="/assets/client-logo.svg"
              width={101}
              height={33}
              alt="Kof’a"
              className="staff-brand"
            />
          </Link>
          <Button
            variant="subtle"
            onClick={() =>
              slug === "conflict" ? setDialog("menu") : action("Back")
            }
          >
            {slug === "conflict" ? "Menu" : "Back"}
          </Button>
          {slug !== "assistant" && slug !== "conflict" && (
            <Button variant="secondary" onClick={() => go("help")}>
              Help
            </Button>
          )}
        </div>
      </header>
      <div className="journey-scroll">
        <form
          ref={form}
          className="journey-body"
          onSubmit={(e) => e.preventDefault()}
        >
          {screen.blocks.map((b) => render(b))}
          {session.notice && <p role="status">{session.notice}</p>}
          {slug === "media" && (
            <p className="text-sm text-muted">
              {photos.length} sample or local photos selected. Source file rows
              above are illustrative; local selection and metadata can be
              managed below.
            </p>
          )}
          <Button variant="secondary" onClick={() => setDialog("menu")}>
            View all 39 media and help screens
          </Button>
          <p className="text-sm text-muted">
            Design examples. Uploads, reports and assistant services are not
            connected. Selected files stay on this device.
          </p>
        </form>
      </div>
      {slug === "media" ? (
        <div className="media-listing-actions">
          <Button
            className="w-full"
            onClick={() => go("/landlord?step=review&preview=1")}
          >
            Review my listing
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => go("/landlord?step=features&preview=1")}
          >
            Back to features
          </Button>
        </div>
      ) : (
        <nav aria-label="Mobile navigation" className="journey-nav">
          {(slug === "conflict"
            ? [
                ["Overview", "/staff-preview/overview", "home"],
                ["Properties", "/staff-preview/properties", "search"],
                ["Inquiries", "/staff-preview/inquiries", "inquiries"],
              ]
            : [
                ["Home", "/", "home"],
                ["Explore", "/properties", "search"],
                ["Inquiries", "/client-preview/inquiries", "inquiries"],
                ["Account", "/account", "account-active"],
              ]
          ).map(([label, target, icon]) => (
            <Link key={label} href={target}>
              <Image
                src={`/assets/mobile-${icon}.svg`}
                width={22}
                height={22}
                alt=""
              />
              {label}
            </Link>
          ))}
          {slug === "conflict" && (
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
      )}
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === "menu"
            ? "Media, help and states · design screens"
            : "Service not connected"
        }
      >
        {dialog === "menu" ? (
          <ol className="journey-directory">
            {mediaScreens.map((s, i) => (
              <li key={s.slug}>
                <Link href={mediaPath(s.slug)} onClick={() => setDialog(null)}>
                  {String(i + 1).padStart(2, "0")} · {s.blocks[1].text}
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="space-y-4">
            <p>
              {operation === "Play walkthrough"
                ? "The source contains a poster only, with no playable video. Choose a local video to preview playback."
                : `${operation} is not connected. No request was sent and no record was changed.`}
            </p>
            {outcome(operation) && (
              <Link
                className="staff-public-link"
                href={mediaPath(outcome(operation)!)}
              >
                Preview example outcome
              </Link>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setDialog(null);
                go("media");
              }}
            >
              Back to media
            </Button>
          </div>
        )}
      </Modal>
    </main>
  );
}
