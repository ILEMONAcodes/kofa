"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { Modal } from "@/components/common/modal";
import { BrandLoading } from "@/components/common/brand-loading";
import {
  useStaffResource,
  staffWrite,
} from "@/components/features/live-staff/data";
import { formatStaffDate } from "@/lib/formatters/date";
import { formatMoney } from "@/lib/formatters/money";
import type { PropertyDetail } from "@/types/property";
import type { ClientAppointment, StaffAppointment } from "@/types/appointment";
import { watInstant, slotTimes } from "./model";
import { SlotForm } from "./slot";
const words = (s: string) => s.replaceAll("_", " ");
function PropertyPhoto({ slug }: { slug: string | null }) {
  const property = useStaffResource<PropertyDetail>(
    slug ? `/properties/${encodeURIComponent(slug)}` : null,
  );
  const cover = property.data?.cover_image;
  return cover ? (
    <Image
      className="journey-photo"
      src={cover.url}
      unoptimized
      width={350}
      height={220}
      alt={cover.alt ?? property.data?.title ?? "Property"}
    />
  ) : null;
}
export function InspectionDetail({ staff }: { staff: boolean }) {
  const id = useSearchParams().get("id");
  const base = id
    ? `${staff ? "/admin" : ""}/appointments/${encodeURIComponent(id)}`
    : null;
  const resource = useStaffResource<ClientAppointment | StaffAppointment>(base);
  const [mode, setMode] = useState<
      | "confirm"
      | "cancel"
      | "request-reschedule"
      | "reschedule"
      | "outcome"
      | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reason, setReason] = useState(""),
    [date, setDate] = useState(""),
    [time, setTime] = useState("10:00"),
    [customTime, setCustomTime] = useState(false),
    [cancelledBy, setCancelledBy] = useState("staff"),
    [outcome, setOutcome] = useState("interested"),
    [notes, setNotes] = useState("");
  const inFlight = useRef(false);
  const row = resource.data;
  const privateRow = row && "client" in row ? row : null;
  const ownRow = row && "meeting_address" in row ? row : null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!base || !row || !mode || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { version: row.version };
      if (mode === "cancel") {
        body.reason = reason;
        if (staff) body.cancelled_by = cancelledBy;
      }
      if (mode === "request-reschedule") {
        body.reason = reason;
        body.preferred_at = date ? watInstant(date, time) : null;
      }
      if (mode === "outcome") {
        body.no_show = outcome === "no_show";
        body.outcome = outcome === "no_show" ? null : outcome;
        body.notes = notes || null;
      }
      await staffWrite(base + "/" + mode, "POST", body);
      setMode(null);
      setNotice("Inspection updated.");
      resource.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update this visit.");
      resource.reload();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (!id)
    return (
      <>
        <h1>Choose an inspection.</h1>
        <Link href={staff ? "/staff/inspections" : "/account/inspections"}>
          Open inspections
        </Link>
      </>
    );
  if (resource.error)
    return (
      <>
        <h1>Unable to open this visit.</h1>
        <p role="alert">
          {resource.error instanceof Error
            ? resource.error.message
            : "Inspection unavailable."}
        </p>
        <Button variant="secondary" onClick={resource.reload}>
          Try again
        </Button>
      </>
    );
  if (!row) return <BrandLoading />;
  if (mode === "reschedule" && privateRow)
    return (
      <SlotForm
        key={row.version}
        record={privateRow}
        onSaved={() => {
          setMode(null);
          setNotice("New time proposed. The client must confirm again.");
          resource.reload();
        }}
      />
    );
  const title =
    row.status === "proposed"
      ? "Your visit is almost set."
      : row.status === "confirmed"
        ? "See you at the doorway."
        : row.status === "reschedule_requested"
          ? "Your request is with us."
          : row.status.startsWith("cancelled")
            ? "Your visit is cancelled."
            : row.status === "completed"
              ? "Your visit is complete."
              : "Your inspection.";
  return (
    <>
      <p className="inspection-eyebrow">
        {staff ? "KOFA WORKSPACE" : "YOUR NEXT CHAPTER"}
      </p>
      <h1>{title}</h1>
      <p>
        {row.reference} · {words(row.status)}
      </p>
      <PropertyPhoto slug={row.property.slug} />
      <h2 className="inspection-date">
        {formatStaffDate(row.scheduled_at)} WAT
      </h2>
      <p>
        {row.property.title}
        <br />
        Kof’a representative: {row.staff_name}
        <br />
        {row.duration_minutes} minutes · Ends{" "}
        {formatStaffDate(row.ends_at, "time")} WAT
      </p>
      {ownRow?.meeting_address ? (
        <section className="inspection-tint">
          <h2>Meeting address</h2>
          <p>{ownRow.meeting_address}</p>
          {ownRow.meeting_instructions && <p>{ownRow.meeting_instructions}</p>}
        </section>
      ) : (
        !staff && (
          <p>
            {["proposed", "reschedule_requested"].includes(row.status)
              ? "Exact address available after confirmation."
              : "The address is not shared for this visit."}
          </p>
        )
      )}
      {row.requested_scheduled_at && (
        <p>
          Requested time: {formatStaffDate(row.requested_scheduled_at)} WAT.
          This time is not confirmed.
        </p>
      )}
      <section className="inspection-tint">
        <h2>Inspection fee · {formatMoney(row.fee.amount)}</h2>
        <p>{row.fee.disclosure}</p>
      </section>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="inspection-actions">
        {row.allowed_actions.includes("confirm") && (
          <Button
            onClick={() => {
              setError("");
              setMode("confirm");
            }}
          >
            Confirm inspection
          </Button>
        )}
        {row.allowed_actions.includes("request_reschedule") && (
          <Button
            variant="secondary"
            onClick={() => {
              setError("");
              setMode("request-reschedule");
            }}
          >
            Request another time
          </Button>
        )}
        {row.allowed_actions.includes("reschedule") && (
          <Button
            onClick={() => {
              setError("");
              setMode("reschedule");
            }}
          >
            Propose another time
          </Button>
        )}
        {row.allowed_actions.includes("cancel") && (
          <Button
            variant="subtle"
            onClick={() => {
              setError("");
              setMode("cancel");
            }}
          >
            Cancel visit
          </Button>
        )}
        {(row.allowed_actions.includes("complete") ||
          row.allowed_actions.includes("no_show")) && (
          <Button
            onClick={() => {
              setError("");
              setMode("outcome");
            }}
          >
            Record inspection outcome
          </Button>
        )}
      </div>
      {privateRow && (
        <>
          <section className="inspection-card">
            <h2>Private visit details</h2>
            <p>
              Client: {privateRow.client.full_name} · {privateRow.client.phone}
            </p>
            <p>Current property address: {privateRow.address_line}</p>
            {privateRow.confirmed_meeting_address && (
              <p>
                Confirmed meeting address:{" "}
                {privateRow.confirmed_meeting_address}
              </p>
            )}
            <p>
              Landlord / representative: {privateRow.landlord_rep_name} ·{" "}
              {privateRow.landlord_rep_phone}
            </p>
            {privateRow.meeting_instructions && (
              <p>{privateRow.meeting_instructions}</p>
            )}
            {privateRow.reschedule_reason && (
              <p>Reschedule request: {privateRow.reschedule_reason}</p>
            )}
            {privateRow.cancellation_reason && (
              <p>Cancellation reason: {privateRow.cancellation_reason}</p>
            )}
            {privateRow.outcome_notes && (
              <p>Internal outcome notes: {privateRow.outcome_notes}</p>
            )}
          </section>
          <section>
            <h2>Status history</h2>
            {privateRow.history.map((h, i) => (
              <p key={i}>
                {words(h.to_status)} · {formatStaffDate(h.created_at)}
                {h.reason ? ` · ${h.reason}` : ""}
              </p>
            ))}
          </section>
        </>
      )}
      {row.outcome && <p>Outcome: {words(row.outcome)}</p>}
      <Link
        className="inspection-back"
        href={`${staff ? "/staff/inquiry" : "/account/conversation"}?id=${row.inquiry_id}`}
      >
        Open inquiry conversation
      </Link>
      <Button variant="secondary" onClick={resource.reload}>
        Refresh inspection
      </Button>
      <Modal
        open={mode !== null && mode !== "reschedule"}
        onClose={() => {
          if (!busy) setMode(null);
        }}
        title={
          mode === "confirm"
            ? "Confirm your inspection"
            : mode === "cancel"
              ? "Cancel this visit"
              : mode === "outcome"
                ? "Record inspection outcome"
                : "Request another time"
        }
      >
        <form className="inspection-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <p>{row.fee.disclosure}</p>
            {mode === "confirm" && (
              <p>
                Confirm {formatStaffDate(row.scheduled_at)} WAT. Your property
                address and meeting instructions will then be available here.
              </p>
            )}
            {(mode === "cancel" || mode === "request-reschedule") && (
              <Input
                label="Reason"
                required
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
            {mode === "cancel" && staff && (
              <Dropdown
                label="Cancellation by"
                value={cancelledBy}
                options={[
                  { value: "staff", label: "Kof’a team" },
                  { value: "landlord", label: "Landlord" },
                ]}
                onChange={(e) => setCancelledBy(e.target.value)}
              />
            )}
            {mode === "request-reschedule" && (
              <>
                <Input
                  label="Preferred date (WAT)"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Dropdown
                  label="Preferred time (WAT)"
                  value={customTime ? "other" : time}
                  options={[
                    ...slotTimes.map((t) => ({ value: t, label: t })),
                    { value: "other", label: "Other time" },
                  ]}
                  onChange={(e) => {
                    setCustomTime(e.target.value === "other");
                    if (e.target.value !== "other") setTime(e.target.value);
                  }}
                />
                {customTime && (
                  <Input
                    label="Other preferred time (WAT)"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required={!!date}
                  />
                )}
                <p>
                  Your original slot stays reserved until our team proposes
                  another time.
                </p>
              </>
            )}
            {mode === "outcome" && (
              <>
                <Dropdown
                  label="Inspection outcome"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  options={[
                    ...(row.allowed_actions.includes("complete")
                      ? [
                          { value: "interested", label: "Interested" },
                          { value: "not_interested", label: "Not interested" },
                          {
                            value: "needs_follow_up",
                            label: "Needs follow-up",
                          },
                        ]
                      : []),
                    ...(row.allowed_actions.includes("no_show")
                      ? [{ value: "no_show", label: "No-show" }]
                      : []),
                  ]}
                />
                <label className="journey-field">
                  Internal outcome notes
                  <textarea
                    required={outcome === "no_show"}
                    maxLength={4000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <p>These notes are private to staff.</p>
              </>
            )}
            {error && <p role="alert">{error}</p>}
            <Button loading={busy} type="submit">
              {mode === "confirm"
                ? "Confirm inspection"
                : mode === "cancel"
                  ? "Confirm cancellation"
                  : mode === "outcome"
                    ? "Save outcome"
                    : "Send reschedule request"}
            </Button>
          </fieldset>
        </form>
      </Modal>
    </>
  );
}
