"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { BrandLoading } from "@/components/common/brand-loading";
import {
  useStaffResource,
  staffWrite,
} from "@/components/features/live-staff/data";
import { formatMoney } from "@/lib/formatters/money";
import type { InquiryDetail } from "@/types/inquiry";
import type { AppointmentOptions, StaffAppointment } from "@/types/appointment";
import { durations, slotTimes, visitLink, watInput, watInstant } from "./model";
export function SlotForm({
  record,
  onSaved,
}: {
  record?: StaffAppointment;
  onSaved?: (row: StaffAppointment) => void;
}) {
  const params = useSearchParams(),
    router = useRouter();
  const inquiryId = record?.inquiry_id ?? params.get("inquiry_id");
  const inquiry = useStaffResource<InquiryDetail>(
    inquiryId && !record
      ? `/admin/inquiries/${encodeURIComponent(inquiryId)}`
      : null,
  );
  const options = useStaffResource<AppointmentOptions>(
    "/admin/appointment-options",
  );
  const initial = record
    ? watInput(record.scheduled_at)
    : { date: "", time: "10:00" };
  const [host, setHost] = useState(record?.staff_id ?? ""),
    [date, setDate] = useState(initial.date),
    [time, setTime] = useState(initial.time),
    [customTime, setCustomTime] = useState(!slotTimes.includes(initial.time)),
    [duration, setDuration] = useState(String(record?.duration_minutes ?? 45)),
    [customDuration, setCustomDuration] = useState(
      !durations.includes(record?.duration_minutes ?? 45),
    ),
    [representative, setRepresentative] = useState(record ? "other" : "owner"),
    [name, setName] = useState(record?.landlord_rep_name ?? ""),
    [phone, setPhone] = useState(record?.landlord_rep_phone ?? ""),
    [instructions, setInstructions] = useState(
      record?.meeting_instructions ?? "",
    ),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const minutes = Number(duration);
      if (!Number.isInteger(minutes) || minutes < 15 || minutes > 240)
        throw new Error("Choose a duration between 15 and 240 minutes.");
      const body = {
        staff_id: host,
        scheduled_at: watInstant(date, time),
        duration_minutes: minutes,
        meeting_instructions: instructions || null,
        landlord_rep_name: representative === "other" ? name : null,
        landlord_rep_phone: representative === "other" ? phone : null,
      };
      const row = await staffWrite<StaffAppointment>(
        record ? `/admin/appointments/${record.id}` : "/admin/appointments",
        record ? "PATCH" : "POST",
        record
          ? { ...body, version: record.version, reason }
          : { ...body, inquiry_id: inquiryId, version: inquiry.data?.version },
      );
      if (onSaved) onSaved(row);
      else router.push(visitLink(true, row.id));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to schedule this visit.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  if (!inquiryId)
    return (
      <>
        <h1>Choose a qualified inquiry.</h1>
        <Link href="/staff/inquiries?status=qualified">
          Open qualified inquiries
        </Link>
      </>
    );
  if (options.error || inquiry.error)
    return (
      <p role="alert">
        Unable to load scheduling details.{" "}
        <Button
          variant="secondary"
          onClick={() => {
            options.reload();
            inquiry.reload();
          }}
        >
          Try again
        </Button>
      </p>
    );
  if (!options.data || (!record && !inquiry.data)) return <BrandLoading />;
  return (
    <>
      <p className="inspection-eyebrow">KOFA WORKSPACE</p>
      <h1>{record ? "Find a time that works." : "Plan the inspection."}</h1>
      <p>
        Schedule from {inquiry.data?.reference ?? `INQ-${record?.inquiry_id}`}
      </p>
      <form className="inspection-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <Input
            label="Property"
            readOnly
            value={
              record?.property.title ??
              inquiry.data?.property?.title ??
              "No property linked"
            }
          />
          <Input
            label="Client"
            readOnly
            value={
              record?.client.full_name ?? inquiry.data?.client.full_name ?? ""
            }
          />
          <Dropdown
            label="Kof’a representative"
            required
            value={host}
            options={[
              { value: "", label: "Choose a team member" },
              ...options.data.staff.map((s) => ({
                value: s.id,
                label: s.full_name,
              })),
            ]}
            onChange={(e) => setHost(e.target.value)}
          />
          <Dropdown
            label="Landlord / representative"
            value={representative}
            options={[
              { value: "owner", label: "Registered property owner" },
              { value: "other", label: "Other authorised representative" },
            ]}
            onChange={(e) => setRepresentative(e.target.value)}
          />
          {representative === "other" && (
            <>
              <Input
                label="Representative name"
                required
                minLength={2}
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Representative phone"
                type="tel"
                placeholder="+234…"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                hint="Private to staff. Use international format, for example +234."
              />
            </>
          )}
          <Input
            label="Inspection date (WAT)"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Dropdown
            label="Start time (WAT)"
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
              label="Other start time (WAT)"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
          <Dropdown
            label="Duration"
            value={customDuration ? "other" : duration}
            options={[
              ...durations.map((d) => ({
                value: String(d),
                label: `${d} minutes`,
              })),
              { value: "other", label: "Other duration" },
            ]}
            onChange={(e) => {
              setCustomDuration(e.target.value === "other");
              if (e.target.value !== "other") setDuration(e.target.value);
            }}
          />
          {customDuration && (
            <Input
              label="Duration in minutes"
              type="number"
              min={15}
              max={240}
              step={1}
              required
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          )}
          <label className="journey-field">
            Meeting instructions
            <textarea
              maxLength={2000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>
          <p>
            Meeting instructions and the property address are shared with this
            client only after confirmation. Keep landlord contact details in the
            private representative fields.
          </p>
          {record && (
            <Input
              label="Reason for rescheduling"
              required
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
          <section className="inspection-tint">
            <h2>Inspection fee · {formatMoney(options.data.fee.amount)}</h2>
            <p>{options.data.fee.disclosure}</p>
          </section>
          {error && <p role="alert">{error}</p>}
          <Button loading={busy} type="submit">
            {record ? "Propose new time" : "Schedule inspection"}
          </Button>
          <Link className="inspection-back" href="/staff/calendar">
            View calendar
          </Link>
        </fieldset>
      </form>
    </>
  );
}
