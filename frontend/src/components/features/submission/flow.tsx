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
import { ApiError } from "@/lib/api/error";
import {
  submissionOptions,
  createDraft,
  uploadFile,
  removeFile,
  submitDraft,
  type DraftReceipt,
  type SubmissionReceipt,
  type EvidenceKind,
} from "./data";
import { submissionPayload } from "./payload";
import type { Taxonomy } from "@/types/filters";
import type { CurrentPolicies } from "@/types/auth";
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
  const router = useRouter();
  const [reset, setReset] = useState(0);
  const preview = false;
  const requested = params.get("step");
  const step = steps.includes(requested as Step)
    ? (requested as Step)
    : "contact";
  return (
    <Wizard
      key={reset}
      onRestart={() => {
        router.replace("/landlord");
        setReset((v) => v + 1);
      }}
      preview={preview}
      step={step}
    />
  );
}
function Wizard({
  preview,
  step: requestedStep,
  onRestart,
}: {
  preview: boolean;
  step: Step;
  onRestart: () => void;
}) {
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const step =
    requestedStep === "receipt" && !receipt ? "contact" : requestedStep;
  const [configuration, setConfiguration] = useState<{
    taxonomy: Taxonomy;
    policies: CurrentPolicies;
  } | null>(null);
  const [configurationError, setConfigurationError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [progress, setProgress] = useState("");
  const [savedDraft, setSavedDraft] = useState<DraftReceipt | null>(null);
  const serverDraft = useRef<DraftReceipt | null>(null);
  const savedPayload = useRef("");
  const [evidenceKind, setEvidenceKind] =
    useState<EvidenceKind>("ownership_proof");
  const evidenceSnapshot = useRef<EvidenceKind>("ownership_proof");
  const [uncertain, setUncertain] = useState(false);
  async function loadOptions() {
    setConfigurationError("");
    try {
      setConfiguration(await submissionOptions());
    } catch {
      setConfigurationError(
        "Listing options could not be loaded. Try again before submitting.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    submissionOptions()
      .then((value) => {
        if (active) setConfiguration(value);
      })
      .catch(() => {
        if (active)
          setConfigurationError(
            "Listing options could not be loaded. Try again before submitting.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const failureText = (issue: unknown) =>
    issue instanceof ApiError
      ? issue.status >= 500
        ? `The listing service is unavailable. Keep this page open and try again.${issue.requestId ? ` Reference: ${issue.requestId}` : ""}`
        : [issue.message, ...issue.details.map((d) => d.message)].join(" ")
      : issue instanceof Error
        ? issue.message
        : "Unable to continue. Try again.";

  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(preview ? sampleDraft : emptyDraft);
  const [media, setMedia] = useState<LocalMedia[]>(
    preview
      ? [
          ...sampleMedia,
          {
            id: "sample-proof",
            kind: "document",
            name: "ownership-proof.pdf",
            sample: true,
          },
        ]
      : [],
  );
  const [error, setError] = useState("");

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
    if (busy || savedDraft) return;
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
  };
  const path = (next: Step, sample = preview) =>
    `/landlord?${sample ? "preview=1&" : ""}step=${next}`;
  const go = (next: Step) => {
    if (inFlight.current) return;
    if (
      savedDraft &&
      ["contact", "property", "pricing", "features"].includes(next)
    ) {
      setError(
        "This draft has been saved. Finish its files and submission, or start a new listing to change its details.",
      );
      return;
    }
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
      minLength={
        key === "full_name"
          ? 2
          : key === "title"
            ? 5
            : key === "address"
              ? 5
              : undefined
      }
      maxLength={
        key === "full_name"
          ? 150
          : key === "title"
            ? 120
            : key === "address"
              ? 500
              : key === "hint"
                ? 160
                : key === "email"
                  ? 254
                  : undefined
      }
      disabled={busy || !!savedDraft}
      pattern={undefined}
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
          : ({
              authorized_agent: "Authorised representative",
              property_manager: "Property manager",
            }[value] ??
            value.charAt(0).toUpperCase() +
              value.slice(1).replaceAll("_", " ")),
    }));
    return (
      <div key={key} className="listing-select-group">
        <Dropdown
          disabled={busy || !!savedDraft}
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
    <Button
      variant="subtle"
      disabled={busy || (!!savedDraft && target !== "uploads")}
      onClick={() => go(target)}
    >
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const issue = stepProblem(step, draft, photoCount, docCount);
    if (issue) {
      setError(issue);
      return;
    }
    if (step !== "review") {
      go(steps[steps.indexOf(step) + 1]);
      return;
    }
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
    if (!configuration) {
      setError(
        "Load the current listing options and policy versions before submitting.",
      );
      return;
    }
    if (uncertain || media.some((m) => m.state === "uncertain")) {
      setError(
        "A previous request could not be confirmed. Keep this page open and contact Help before starting another listing.",
      );
      return;
    }
    let payload;
    try {
      payload = submissionPayload(
        draft,
        configuration.taxonomy,
        configuration.policies,
      );
    } catch (issue) {
      setError(failureText(issue));
      return;
    }
    const fingerprint = JSON.stringify(payload);
    if (serverDraft.current && savedPayload.current !== fingerprint) {
      setError(
        "The saved draft cannot be changed here. Start a new listing to change its details.",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      let remote = serverDraft.current;
      if (!remote) {
        setProgress("Saving your private draft…");
        try {
          remote = await createDraft(payload);
        } catch (issue) {
          if (
            issue instanceof ApiError &&
            (issue.status === 0 ||
              issue.code === "UPSTREAM_ERROR" ||
              issue.status === 500)
          )
            setUncertain(true);
          throw issue;
        }
        serverDraft.current = remote;
        setSavedDraft(remote);
        savedPayload.current = fingerprint;
        evidenceSnapshot.current = evidenceKind;
      }
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        if (item.serverId) continue;
        if (!item.file)
          throw new Error("Select the original file again before uploading.");
        setProgress(`Uploading file ${i + 1} of ${media.length}…`);
        setMedia((items) =>
          items.map((m) =>
            m.id === item.id ? { ...m, state: "uploading" } : m,
          ),
        );
        try {
          const uploaded = await uploadFile(
            remote,
            item.file,
            item.kind === "document" ? evidenceSnapshot.current : item.kind,
          );
          setMedia((items) =>
            items.map((m) =>
              m.id === item.id
                ? { ...m, serverId: uploaded.file_id, state: "uploaded" }
                : m,
            ),
          );
        } catch (issue) {
          const unknown =
            issue instanceof ApiError &&
            (issue.status === 0 ||
              issue.code === "UPSTREAM_ERROR" ||
              issue.status === 500);
          setMedia((items) =>
            items.map((m) =>
              m.id === item.id
                ? { ...m, state: unknown ? "uncertain" : "error" }
                : m,
            ),
          );
          throw issue;
        }
      }
      setProgress("Sending your listing for review…");
      const confirmed = await submitDraft(remote);
      setReceipt(confirmed);
      setProgress("");
      router.push(path("receipt"), { scroll: false });
    } catch (issue) {
      setError(failureText(issue));
      setProgress(
        serverDraft.current
          ? "Your submission is not confirmed. Successfully uploaded files remain attached to this draft."
          : "Your draft was not confirmed. Check the error before trying again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function deleteMedia(item: LocalMedia) {
    if (inFlight.current)
      throw new Error("Wait for the current operation to finish.");
    if (item.state === "uncertain")
      throw new Error(
        "This upload was not confirmed. Contact Help with your draft ID before restarting.",
      );
    inFlight.current = true;
    setBusy(true);
    try {
      if (item.serverId && serverDraft.current)
        await removeFile(serverDraft.current, item.serverId);
      setMedia((items) => items.filter((m) => m.id !== item.id));
      setError("");
    } catch (issue) {
      throw new Error(failureText(issue));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      className={`auth-screen listing-screen listing-${step}`}
      data-figma-node={data.node}
    >
      <div className="auth-scroll" ref={scroll}>
        <header className="auth-header">
          <span className="listing-preview-tag">The doorway to your home</span>
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
          onSubmit={(event) => void submit(event)}
        >
          <p className="listing-eyebrow">{data.eyebrow}</p>
          <h1 ref={heading} tabIndex={-1}>
            {data.title}
          </h1>
          <p className="auth-description">{data.description}</p>
          {!receipt && (
            <p className="auth-small">
              Keep this page open until submission finishes. Refreshing clears
              the form and selected files from this device.
            </p>
          )}
          {!configuration && !configurationError && (
            <p role="status">Loading listing options…</p>
          )}
          {configuration && !configuration.taxonomy.areas.length && (
            <p role="alert">
              No listing areas are available yet. Please contact our team before
              submitting.
            </p>
          )}
          {configurationError && (
            <div role="alert">
              <p>{configurationError}</p>
              <Button variant="secondary" onClick={() => void loadOptions()}>
                Retry listing options
              </Button>
            </div>
          )}
          {savedDraft && !receipt && (
            <div className="auth-callout">
              <p>Draft saved</p>
              <p>
                Your details are saved privately. Finish the files below and
                submit. To change saved property or contact details, start a new
                listing.
              </p>
              <p>Draft ID: {savedDraft.id}</p>
              <Link
                href="/landlord"
                onClick={(e) => {
                  e.preventDefault();
                  if (!inFlight.current) onRestart();
                }}
              >
                Start a new listing
              </Link>
            </div>
          )}
          {progress && <p role="status">{progress}</p>}
          {busy && (
            <progress
              aria-label="Files confirmed uploaded"
              max={Math.max(1, media.length)}
              value={media.filter((m) => m.serverId).length}
            />
          )}

          {(uncertain || media.some((m) => m.state === "uncertain")) && (
            <Link href="/resources/help">Get help with this draft</Link>
          )}
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
              {select(
                "relationship",
                "Relationship to property",
                ["owner", "authorized_agent", "developer", "property_manager"],
                false,
              )}
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
              {select("state", "State", [
                ...new Set(
                  configuration?.taxonomy.areas.map((a) => a.state) ?? [],
                ),
              ])}
              {select("city", "City", [
                ...new Set(
                  configuration?.taxonomy.areas
                    .filter((a) => a.state === draft.state)
                    .map((a) => a.city) ?? [],
                ),
              ])}
              {select(
                "area",
                "Neighbourhood",
                configuration?.taxonomy.areas
                  .filter(
                    (a) => a.state === draft.state && a.city === draft.city,
                  )
                  .map((a) => a.neighbourhood) ?? [],
              )}
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
                  maxLength={2000}
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
                  ...(configuration?.taxonomy.amenities.map((a) => ({
                    value: a.code,
                    label: a.label,
                  })) ?? []),
                  { value: "other", label: "Other" },
                ]}
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
            <Dropdown
              label="Evidence type"
              value={evidenceKind}
              disabled={busy || !!savedDraft}
              onChange={(e) => setEvidenceKind(e.target.value as EvidenceKind)}
              options={[
                { value: "ownership_proof", label: "Ownership proof" },
                {
                  value: "authorization_letter",
                  label: "Authorisation letter",
                },
              ]}
            />
            <MediaPicker
              media={media}
              onChange={setMedia}
              preview={false}
              busy={busy}
              lockedOrdering={!!savedDraft}
              onRemove={deleteMedia}
            />
          </div>
          {step === "review" && (
            <>
              {callout(
                "Your contact · private",
                preview
                  ? "Property owner · Phone and optional email are only visible to staff."
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
                `${photoCount} property photos ${savedDraft ? "attached to draft or awaiting upload" : "selected locally"} · ${docCount} private ownership document${docCount === 1 ? "" : "s"} ${savedDraft ? "attached to draft or awaiting upload" : "selected locally"}`,
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
                      disabled={busy || !!savedDraft}
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
                View Terms and Privacy Policy
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
              {callout("Your reference", receipt?.reference ?? "")}
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
          <Button
            form="listing-form"
            type="submit"
            loading={busy}
            disabled={uncertain}
          >
            {data.action}
          </Button>
        )}
        {step === "contact" || step === "verification" ? (
          <Link className={buttonStyles("subtle")} href="/properties">
            Back to browsing
          </Link>
        ) : step === "receipt" ? (
          <Link
            className={buttonStyles("subtle")}
            href="/landlord"
            onClick={(event) => {
              event.preventDefault();
              onRestart();
            }}
          >
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
        open={policies}
        onClose={() => setPolicies(false)}
        title="Terms and Privacy Policy"
      >
        <p>
          Your submission records the policy versions you accept below. Your
          contact details and evidence stay private.
        </p>
        {configuration?.policies.policies.map((p) => (
          <p key={p.type}>
            <Link
              href={
                p.type === "terms" ? "/resources/terms" : "/resources/privacy"
              }
              target="_blank"
              rel="noreferrer"
            >
              {p.type === "terms" ? "Terms" : "Privacy"} · {p.version}
            </Link>
          </p>
        ))}
      </Modal>
    </div>
  );
}
