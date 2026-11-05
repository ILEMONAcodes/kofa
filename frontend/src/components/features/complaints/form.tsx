"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { apiRequest } from "@/lib/api/client";
import { ensureCsrf } from "@/lib/auth/client";
import {
  staffWrite,
  useStaffResource,
} from "@/components/features/live-staff/data";
import type { CaseEvidence, CaseReceipt } from "@/types/complaint";
import type { ClientAppointment } from "@/types/appointment";
import { watInput } from "@/components/features/inspections/model";
import { caseLink, evidenceError, opts, reasons } from "./model";
export function TextArea({
  label,
  value,
  onChange,
  maxLength = 4000,
  minLength = 0,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <label className="journey-field">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        minLength={minLength}
        required={required}
      />
    </label>
  );
}
export function CaseForm({
  publicReport = false,
  initialSlug,
  initialTitle,
}: {
  publicReport?: boolean;
  initialSlug?: string;
  initialTitle?: string;
}) {
  const params = useSearchParams();
  const [slug, setSlug] = useState(initialSlug ?? params.get("property") ?? ""),
    [reason, setReason] = useState("fake_listing"),
    [kind, setKind] = useState("service_complaint"),
    [subject, setSubject] = useState(
      params.get("appointment")
        ? `appointment:${params.get("appointment")}`
        : params.get("property_id")
          ? `property:${params.get("property_id")}`
          : "general",
    );
  const [description, setDescription] = useState(""),
    [date, setDate] = useState(""),
    [desired, setDesired] = useState(""),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [website, setWebsite] = useState("");
  const [files, setFiles] = useState<File[]>([]),
    [receipt, setReceipt] = useState<CaseReceipt | null>(null),
    [uploaded, setUploaded] = useState<{ file: File; record: CaseEvidence }[]>(
      [],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const appointments = useStaffResource<ClientAppointment[]>(
    publicReport ? null : "/appointments",
  );
  const [listingQuery, setListingQuery] = useState("");
  const listings = useStaffResource<{ slug: string; title: string }[]>(
    publicReport && !initialSlug ? "/properties" : null,
    new URLSearchParams({ q: listingQuery }).toString(),
  );
  const path = publicReport ? "/reports" : "/complaints";
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    let confirmed = receipt;
    try {
      const fileError = evidenceError(files);
      if (fileError) throw new Error(fileError);
      if (!confirmed) {
        const [type, id] = subject.split(":");
        confirmed = await staffWrite<CaseReceipt>(
          path,
          "POST",
          publicReport
            ? {
                property_slug: slug,
                reason,
                description,
                reporter: {
                  name: name || null,
                  email: email || null,
                  phone: phone || null,
                },
                website,
              }
            : {
                kind,
                subject: { type, id: id || null },
                description,
                occurred_on: date || null,
                desired_outcome: desired || null,
              },
        );
        setReceipt(confirmed);
      }
      await ensureCsrf();
      for (const file of files) {
        if (uploaded.some((x) => x.file === file)) continue;
        const body = new FormData();
        body.append("file", file);
        const result = await apiRequest<CaseEvidence>(
          `${path}/${confirmed.id}/files`,
          {
            method: "POST",
            headers: { "X-Upload-Token": confirmed.upload_token },
            body,
            timeoutMs: 120000,
          },
        );
        setUploaded((old) => [...old, { file, record: result.data }]);
      }
      setFiles([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to submit. Please try again.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function remove(item: { file: File; record: CaseEvidence }) {
    if (!receipt || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await ensureCsrf();
      await apiRequest(`${path}/${receipt.id}/files/${item.record.id}`, {
        method: "DELETE",
        headers: { "X-Upload-Token": receipt.upload_token },
      });
      setUploaded((old) => old.filter((x) => x !== item));
      setFiles((old) => old.filter((x) => x !== item.file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove file.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <>
      <p className="inspection-eyebrow">
        {publicReport ? "A SAFER SEARCH" : "YOUR NEXT CHAPTER"}
      </p>
      <h1>
        {receipt
          ? "Your concern is with us."
          : publicReport
            ? "Something doesn’t look right?"
            : "Tell us what happened."}
      </h1>
      <p>We will review your concern before deciding on any action.</p>
      {error && <p role="alert">{error}</p>}
      {receipt && (
        <section className="inspection-tint" role="status">
          <strong>{receipt.reference}</strong>
          <p>{receipt.message}</p>
          <p>
            {error
              ? "Your case is saved. Retry the remaining evidence below; do not submit another case."
              : "Keep this reference for your records."}
          </p>
        </section>
      )}
      <form className="inspection-form" onSubmit={submit}>
        <fieldset disabled={busy || !!receipt}>
          {publicReport ? (
            <>
              {initialSlug ? (
                <section className="inspection-stack">
                  <h2>Listing</h2>
                  <p>{initialTitle ?? initialSlug}</p>
                </section>
              ) : (
                <>
                  <Input
                    label="Find a listing"
                    value={listingQuery}
                    onChange={(e) => setListingQuery(e.target.value)}
                  />
                  <Dropdown
                    label="Property listing"
                    options={[
                      { value: "", label: "Choose a property" },
                      ...(listings.data ?? []).map((p) => ({
                        value: p.slug,
                        label: p.title,
                      })),
                    ]}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                  />
                  <Link href="/properties">
                    Browse properties to report a listing
                  </Link>
                </>
              )}
              <Dropdown
                label="Reason"
                options={opts(reasons)}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </>
          ) : (
            <>
              <Dropdown
                label="Complaint kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                options={opts(["service_complaint", "dispute", "other"])}
              />
              <Dropdown
                label="Related to"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                options={[
                  { value: "general", label: "General concern" },
                  ...(params.get("property_id")
                    ? [
                        {
                          value: `property:${params.get("property_id")}`,
                          label: "This property",
                        },
                      ]
                    : []),
                  ...(appointments.data ?? []).map((a) => ({
                    value: `appointment:${a.id}`,
                    label: `My appointment ${a.reference}`,
                  })),
                ]}
              />
            </>
          )}
          <TextArea
            label={
              publicReport && reason === "other"
                ? "Describe your other concern"
                : "Description"
            }
            value={description}
            onChange={setDescription}
            minLength={20}
            maxLength={publicReport ? 2000 : 4000}
            required
          />
          {publicReport ? (
            <>
              <Input
                label="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
              />
              <Input
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Phone (optional)"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234…"
              />
              <label className="complaint-honeypot" aria-hidden="true">
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
              <p>Without contact details, we cannot follow up.</p>
            </>
          ) : (
            <>
              <Input
                label="Date it happened (optional)"
                type="date"
                max={watInput(new Date().toISOString()).date}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <TextArea
                label="Desired outcome (optional)"
                value={desired}
                onChange={setDesired}
                maxLength={500}
              />
            </>
          )}
        </fieldset>
        <section className="inspection-stack">
          <h2>Supporting evidence · Optional</h2>
          <p>
            Up to 3 files · JPEG, PNG or PDF · 5 MB each · Private to authorised
            staff
          </p>
          <Input
            label="Add evidence"
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            disabled={busy || uploaded.length >= 3}
            onChange={(e) => {
              const selected = [
                ...uploaded.map((x) => x.file),
                ...Array.from(e.target.files ?? []),
              ];
              const error = evidenceError(selected);
              setError(error);
              if (!error) setFiles(selected);
              e.target.value = "";
            }}
          />
          {files
            .filter((f) => !uploaded.some((x) => x.file === f))
            .map((f, i) => (
              <div key={i} className="inspection-card">
                <span>{f.name}</span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setFiles((old) => old.filter((x) => x !== f))}
                >
                  Remove selected file {i + 1}
                </Button>
              </div>
            ))}
          {uploaded.map((x, i) => (
            <div className="inspection-card" key={x.record.id}>
              <p>{x.file.name} · Uploaded</p>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => remove(x)}
              >
                Remove uploaded evidence {i + 1}
              </Button>
            </div>
          ))}
        </section>
        <section className="inspection-tint">
          <strong>Keep sensitive details out</strong>
          <p>
            Do not include card, bank or identity-document numbers. Reports are
            unverified allegations. Your evidence is private to authorised
            staff.
          </p>
        </section>
        <Button disabled={busy} type="submit">
          {busy
            ? "Saving…"
            : receipt
              ? "Upload selected evidence"
              : publicReport
                ? "Submit report"
                : "Submit complaint"}
        </Button>
      </form>
      {receipt && !publicReport && (
        <Link className="inspection-back" href={caseLink(false, receipt.id)}>
          Track my complaint
        </Link>
      )}
      <Link
        className="inspection-back"
        href={
          publicReport && slug
            ? `/properties/${encodeURIComponent(slug)}`
            : "/account/complaints"
        }
      >
        {publicReport ? "Back to properties" : "My complaints"}
      </Link>
    </>
  );
}
