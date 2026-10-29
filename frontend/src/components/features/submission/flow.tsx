"use client";
/* eslint-disable @next/next/no-img-element -- Exact Figma exports at intrinsic dimensions. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/common/input";
import { Button, buttonStyles } from "@/components/common/button";
import { Dropdown } from "@/components/common/dropdown";
import { PopoverSelect } from "@/components/common/popover-select";
import { Modal } from "@/components/common/modal";
import { formatMoney, parseMoneyInput } from "@/lib/formatters/money";
import { MediaPicker, sampleMedia, type LocalMedia } from "./media";
import {
  screens,
  steps,
  emptyDraft,
  sampleDraft,
  stepProblem,
  displayValue,
  type Draft,
  type Step,
} from "./model";
export function SubmissionFlow() {
  const params = useSearchParams();
  const preview = params.get("preview") === "1";
  const requested = params.get("step");
  const step = steps.includes(requested as Step)
    ? (requested as Step)
    : "contact";
  return (
    <Wizard
      key={preview ? "sample" : "new"}
      preview={preview}
      step={step === "receipt" && !preview ? "review" : step}
    />
  );
}
function Wizard({ preview, step }: { preview: boolean; step: Step }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(preview ? sampleDraft : emptyDraft);
  const [media, setMedia] = useState<LocalMedia[]>(
    preview
      ? [
          ...sampleMedia,
          {
            id: "sample-proof",
            kind: "document",
            name: "Sample-ownership-proof.pdf",
            sample: true,
          },
        ]
      : [],
  );
  const [error, setError] = useState("");
  const [service, setService] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [policies, setPolicies] = useState(false);
  const [consent, setConsent] = useState({ owner: preview, policies: preview });
  const scroll = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(step);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ block: "nearest" });
      errorRef.current?.focus();
    }
  }, [error]);
  useEffect(() => {
    scroll.current?.scrollTo(0, 0);
    if (previous.current !== step) heading.current?.focus();
    previous.current = step;
  }, [step]);
  const set = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  };
  const path = (next: Step, sample = preview) =>
    `/landlord?${sample ? "preview=1&" : ""}step=${next}`;
  const go = (next: Step) => {
    setError("");
    router.push(path(next), { scroll: false });
  };
  const photoCount = media.filter((m) => m.kind === "photo").length,
    docCount = media.filter((m) => m.kind === "document").length;
  const data = screens[step];
  const field = (
    key: string,
    label: string,
    placeholder: string,
    optional = false,
    type = "text",
  ) => (
    <Input
      key={key}
      name={key}
      label={label}
      placeholder={placeholder}
      type={type}
      value={draft[key] ?? ""}
      onChange={(e) => set(key, e.target.value)}
      required={!optional}
      autoComplete={
        key === "full_name"
          ? "name"
          : key === "phone"
            ? "tel"
            : key === "email"
              ? "email"
              : undefined
      }
      minLength={key === "full_name" ? 2 : key === "title" ? 5 : undefined}
      maxLength={key === "full_name" ? 150 : key === "title" ? 120 : undefined}
      pattern={key === "phone" ? "\\+[1-9][0-9]{6,14}" : undefined}
      title={
        key === "phone"
          ? "Use international format, for example +2348012345678"
          : undefined
      }
    />
  );
  const select = (
    key: string,
    label: string,
    values: string[],
    other = true,
    optional = false,
  ) => {
    const options = values.map((value) => ({
      value,
      label:
        key === "period"
          ? `Per ${value}`
          : value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " "),
    }));
    return (
      <div key={key} className="listing-select-group">
        <Dropdown
          label={label}
          name={key}
          value={draft[key] ?? ""}
          onChange={(e) => set(key, e.target.value)}
          required={!optional}
          options={[
            { value: "", label: optional ? "None" : "Choose an option" },
            ...options,
            ...(other ? [{ value: "other", label: "Other" }] : []),
          ]}
        />
        {["state", "city", "area"].includes(key) && (
          <img
            className="listing-source-chevron"
            src="/assets/search-chevron.svg"
            width="20"
            height="20"
            alt=""
          />
        )}
        {draft[key] === "other" &&
          field(
            `${key}Other`,
            `${label} — specify your preference`,
            "Specify your preference",
          )}
      </div>
    );
  };
  const callout = (title: string, text: string) => (
    <div className="auth-callout">
      <p>{title}</p>
      <p>{text}</p>
    </div>
  );
  const friendly = (key: string) => {
    const value = displayValue(draft, key).replaceAll("_", " ");
    return value.charAt(0).toUpperCase() + value.slice(1);
  };
  const moneyText = (raw: string) => {
    try {
      const amount = parseMoneyInput(raw ?? "");
      return amount === null ? "Price not provided" : formatMoney(amount);
    } catch {
      return "Invalid amount";
    }
  };
  const edit = (target: Step, label: string) => (
    <Button variant="subtle" onClick={() => go(target)}>
      {label}
    </Button>
  );
  const money = (key: string, label: string, optional = false) => {
    const adjust = (direction: number) => {
      try {
        const amount = parseMoneyInput(draft[key] ?? "") ?? 0;
        const next = Math.max(0, amount + direction * 10000000);
        if (Number.isSafeInteger(next)) set(key, formatMoney(next).slice(1));
      } catch {
        setError("Enter a valid naira amount before adjusting it.");
      }
    };
    return (
      <div className="listing-money">
        <span className="listing-currency" aria-hidden="true">
          ₦
        </span>
        <Input
          label={label}
          name={key}
          placeholder={key === "price" ? "3,500,000" : "350,000"}
          inputMode="decimal"
          required={!optional}
          value={draft[key] ?? ""}
          onChange={(e) => set(key, e.target.value)}
        />
        <div>
          <button
            type="button"
            aria-label={`Decrease ${label.toLowerCase()} by 100,000 naira`}
            onClick={() => adjust(-1)}
          >
            −
          </button>
          <button
            type="button"
            aria-label={`Increase ${label.toLowerCase()} by 100,000 naira`}
            onClick={() => adjust(1)}
          >
            +
          </button>
        </div>
      </div>
    );
  };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = stepProblem(step, draft, photoCount, docCount);
    if (issue) {
      setError(issue);
      return;
    }
    if (step === "review") {
      for (const key of steps.slice(0, 5)) {
        const missing = stepProblem(key, draft, photoCount, docCount);
        if (missing) {
          go(key);
          setError(missing);
          return;
        }
      }
      if (!consent.owner || !consent.policies) {
        setError(
          "Confirm the listing information and policy checkbox before continuing.",
        );
        return;
      }
      setService(true);
      return;
    }
    go(steps[steps.indexOf(step) + 1]);
  }
  return (
    <div
      className={`auth-screen listing-screen listing-${step}`}
      data-figma-node={data.node}
    >
      <div className="auth-scroll" ref={scroll}>
        <header className="auth-header">
          <span className="listing-preview-tag">
            {preview
              ? "Design preview · sample content"
              : "Local preview · nothing is submitted"}
          </span>
          <Link href="/properties" aria-label="Back to properties">
            <img src="/assets/mobile-back.svg" width="22" height="22" alt="" />
          </Link>
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
        </header>
        <form
          className="auth-form listing-form"
          id="listing-form"
          onSubmit={submit}
        >
          <p className="listing-eyebrow">{data.eyebrow}</p>
          <h1 ref={heading} tabIndex={-1}>
            {data.title}
          </h1>
          <p className="auth-description">{data.description}</p>
          {step === "contact" && (
            <>
              {field("full_name", "Full name", "Your full name")}
              {field("phone", "Phone number", "+234", false, "tel")}
              {field(
                "email",
                "Email (optional)",
                "you@example.com",
                true,
                "email",
              )}
              {select("relationship", "Relationship to property", [
                "owner",
                "authorised representative",
              ])}
              {callout(
                "Your contact details stay private",
                "Visitors and clients speak with Kof’a. Your phone, email and evidence documents are not displayed publicly.",
              )}
            </>
          )}
          {step === "property" && (
            <>
              {field("title", "Listing title", "3-bedroom flat, Wuse 2")}
              {select("property_type", "Property type", [
                "apartment",
                "house",
                "duplex",
                "bungalow",
                "terrace",
                "studio",
                "room",
              ])}
              {select("intended_use", "Intended use", ["residential"], false)}
              {select("state", "State", ["FCT"])}
              {select("city", "City", ["Abuja"])}
              {select("area", "Neighbourhood", [
                "Wuse 2",
                "Maitama",
                "Asokoro",
                "Gwarinpa",
                "Jabi",
                "Jahi",
                "Garki",
                "Katampe",
                "Lugbe",
              ])}
              {field(
                "address",
                "Exact address (private)",
                "12 Example Street, Wuse 2",
              )}
              {field(
                "hint",
                "Public location hint",
                "Near the neighbourhood centre",
                true,
              )}
              {callout(
                "A public neighbourhood, a private address",
                "Only approximate location information appears in the public listing. Our team handles exact-address disclosure through the inspection process.",
              )}
              <label className="listing-textarea">
                Property description
                <textarea
                  name="description"
                  value={draft.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                  required
                  minLength={20}
                  maxLength={5000}
                  className="field-control"
                  placeholder="Describe the space and what it offers"
                />
              </label>
              <label className="listing-textarea">
                Landlord conditions (optional)
                <textarea
                  name="conditions"
                  value={draft.conditions ?? ""}
                  onChange={(e) => set("conditions", e.target.value)}
                  maxLength={5000}
                  className="field-control"
                  placeholder="Any conditions prospective residents should know"
                />
              </label>
            </>
          )}
          {step === "pricing" && (
            <>
              {select("listing_type", "Rent or sale", ["rent", "sale"], false)}
              {money("price", "Price in naira")}
              {draft.listing_type === "rent" &&
                select("period", "Rent period", ["year", "month"], false)}
              {select("negotiable", "Negotiable?", ["no", "yes"], false)}
              {select(
                "payment_terms",
                "Payment terms",
                draft.listing_type === "rent"
                  ? ["1 year upfront", "6 months upfront", "Monthly payment"]
                  : ["Outright purchase", "Instalment payment"],
              )}
              {select(
                "charge_label",
                "Additional charge label",
                ["Caution fee", "Service charge", "Maintenance charge"],
                true,
                true,
              )}
              {money("charge", "Additional charge in naira", true)}
              {callout(
                "Property charges and service fees",
                "List all additional property charges here. Our team will explain any service fees separately before you agree to proceed.",
              )}
            </>
          )}
          {step === "features" && (
            <>
              {select(
                "bedrooms",
                "Bedrooms",
                Array.from({ length: 21 }, (_, i) => String(i)),
              )}
              {select(
                "bathrooms",
                "Bathrooms",
                Array.from({ length: 21 }, (_, i) => String(i)),
                false,
              )}
              {select("furnishing", "Furnishing", [
                "unfurnished",
                "semi_furnished",
                "furnished",
              ])}
              {select(
                "availability",
                "Availability",
                ["available", "under_offer", "unavailable"],
                false,
              )}
              <PopoverSelect
                label="Amenities"
                title="Property amenities"
                description="Choose all that apply."
                multiple
                value={draft.amenities ?? ""}
                options={[
                  "Parking",
                  "Generator",
                  "Fitted kitchen",
                  "Water supply",
                  "Security",
                  "Lift",
                  "other",
                ].map((value) => ({
                  value,
                  label: value === "other" ? "Other" : value,
                }))}
                onChange={(value) => set("amenities", value)}
              />
              {draft.amenities?.split(",").includes("other") &&
                field(
                  "amenitiesOther",
                  "Amenities — specify your preference",
                  "Specify your preference",
                )}
            </>
          )}
          <div className="listing-media-fields" hidden={step !== "uploads"}>
            <MediaPicker media={media} onChange={setMedia} preview={preview} />
          </div>
          {step === "review" && (
            <>
              {callout(
                "Your contact · private",
                preview
                  ? "Sample owner · Phone and optional email are only visible to staff."
                  : `${draft.full_name || "Name not provided"} · Phone and optional email are only visible to staff.`,
              )}
              {edit("contact", "Edit your contact")}
              {callout(
                "Property",
                `${displayValue(draft, "title")} · ${friendly("property_type")} · ${friendly("intended_use")}\nExact address is private.`,
              )}
              {edit("property", "Edit property")}
              {callout(
                "Price and terms",
                `${moneyText(draft.price)}${draft.listing_type === "rent" ? ` /${draft.period}` : ""} · ${displayValue(draft, "payment_terms")}\n${draft.charge_label ? `${displayValue(draft, "charge_label")}: ${moneyText(draft.charge)}` : "No additional charges listed"}`,
              )}
              {edit("pricing", "Edit price and terms")}
              {callout(
                "Features",
                `${displayValue(draft, "bedrooms")} bed · ${displayValue(draft, "bathrooms")} bath · ${friendly("furnishing")}\n${
                  draft.amenities
                    ?.split(",")
                    .filter((value) => value !== "other")
                    .join(" · ") || "No amenities selected"
                }${draft.amenitiesOther ? ` · ${draft.amenitiesOther}` : ""}`,
              )}
              {edit("features", "Edit features")}
              {callout(
                "Photos and evidence",
                `${photoCount} property photos ${preview ? "ready" : "selected locally"} · ${docCount} private ownership document${docCount === 1 ? "" : "s"} ${preview ? "ready" : "selected locally"}`,
              )}
              {edit("uploads", "Edit photos and evidence")}
              {(
                [
                  [
                    "owner",
                    "I confirm I am the owner or an authorised representative and the listing information is accurate.",
                  ],
                  [
                    "policies",
                    "I agree to the Terms and Privacy Policy for this submission.",
                  ],
                ] as const
              ).map(([key, label]) => (
                <label className="listing-consent" key={key}>
                  <span>
                    <input
                      type="checkbox"
                      required
                      checked={consent[key]}
                      onChange={(e) =>
                        setConsent((c) => ({ ...c, [key]: e.target.checked }))
                      }
                    />
                    <img
                      src="/assets/listing-check.svg"
                      width="20"
                      height="20"
                      alt=""
                    />
                  </span>
                  <span>{label}</span>
                </label>
              ))}
              <button
                type="button"
                className="auth-text-link"
                onClick={() => setPolicies(true)}
              >
                Policy content is pending legal review in this design preview.
              </button>
              <div className="auth-callout listing-review-video">
                <p>Optional walkthrough video</p>
                <p>{`${media.find((m) => m.kind === "video")?.name ?? (preview ? "walkthrough.mp4 · Ready" : "No video selected")} · Optional. Photos and video may be public after approval; ownership documents remain private.`}</p>
                {edit("uploads", "Edit photos / video")}
              </div>
            </>
          )}
          {step === "receipt" && (
            <>
              <span className="listing-status">
                Submitted · Awaiting review
              </span>
              {callout(
                "Your reference",
                "SUB-2026-000123 · Illustrative reference",
              )}
              <p className="auth-description">
                Keep this reference. Our team will contact you using the details
                you provided. We will ask you to approve the advertised price
                and description before publication.
              </p>
              <p className="auth-small">
                No landlord account or public tracking dashboard is required.
              </p>
            </>
          )}
          {step === "verification" && (
            <>
              {[
                [
                  "Submission received",
                  "Your contact details, property information, photos and evidence reach our team.",
                ],
                [
                  "Staff review",
                  "We check the identity, ownership documents, location, price and features.",
                ],
                [
                  "Your approval",
                  "We contact you to confirm the advertised price and description.",
                ],
                [
                  "Publication decision",
                  "A property is published only after the required checks pass and current approval is recorded.",
                ],
              ].map(([title, text], i) => (
                <div className="listing-verification-step" key={title}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h2>{title}</h2>
                    <p className="auth-description">{text}</p>
                  </div>
                </div>
              ))}
              {callout(
                "Verification has a defined scope",
                "Verification confirms the checks listed. It is not a guarantee of legal title.",
              )}
            </>
          )}
          {error && (
            <p
              ref={errorRef}
              tabIndex={-1}
              className="listing-error"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="auth-preview-note">
            <p>
              {preview
                ? "Illustrative design only. No submission or upload has taken place."
                : "Use sample details/files. Your progress stays in memory and resets on reload. Nothing is uploaded or submitted."}
            </p>
            <button
              className="auth-text-link"
              type="button"
              onClick={() => setGallery(true)}
            >
              Preview all listing screens
            </button>
          </div>
        </form>
      </div>
      <div className="auth-actions">
        {step === "receipt" ? (
          <Button onClick={() => go("verification")}>{data.action}</Button>
        ) : step === "verification" ? (
          <Link className={buttonStyles()} href="/">
            {data.action}
          </Link>
        ) : (
          <Button form="listing-form" type="submit">
            {data.action}
          </Button>
        )}
        {step === "contact" || step === "verification" ? (
          <Link className={buttonStyles("subtle")} href="/properties">
            Back to browsing
          </Link>
        ) : step === "receipt" ? (
          <Link className={buttonStyles("subtle")} href="/landlord">
            List another property
          </Link>
        ) : (
          <Button
            variant="subtle"
            onClick={() => go(steps[steps.indexOf(step) - 1])}
          >
            Back
          </Button>
        )}
      </div>
      <Modal
        open={service}
        onClose={() => setService(false)}
        title="Listing submissions are being connected."
      >
        <p>
          No files or contact details have been sent. This preview cannot
          submit, verify or publish a property.
        </p>
        <Link
          href={path("receipt", true)}
          onClick={() => setService(false)}
          className={buttonStyles("secondary", "mt-5")}
        >
          Preview the sample receipt
        </Link>
      </Modal>
      <Modal
        open={gallery}
        onClose={() => setGallery(false)}
        title="Listing design previews"
      >
        <nav className="auth-preview-links" aria-label="Listing previews">
          {steps.map((key, i) => (
            <Link
              key={key}
              href={path(key, true)}
              onClick={() => setGallery(false)}
            >
              {String(i + 1).padStart(2, "0")} — {screens[key].title}
            </Link>
          ))}
        </nav>
      </Modal>
      <Modal
        open={policies}
        onClose={() => setPolicies(false)}
        title="Policies are being prepared."
      >
        <p>
          Approved policy versions will appear before real submissions become
          available. No legal consent is recorded in this preview.
        </p>
      </Modal>
    </div>
  );
}
