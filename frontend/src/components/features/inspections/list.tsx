"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { BrandLoading } from "@/components/common/brand-loading";
import { useStaffResource } from "@/components/features/live-staff/data";
import { formatStaffDate } from "@/lib/formatters/date";
import {
  appointmentStatuses,
  type AppointmentSummary,
  type AppointmentOptions,
} from "@/types/appointment";
import { dateWindow, nextDate, visitLink, watInput } from "./model";
const words = (value: string) => value.replaceAll("_", " ");
export function InspectionList({
  staff,
  calendar,
}: {
  staff: boolean;
  calendar: boolean;
}) {
  const params = useSearchParams();
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [host, setHost] = useState(""),
    [start, setStart] = useState(
      calendar ? watInput(new Date().toISOString()).date : "",
    ),
    [end, setEnd] = useState("");
  const options = useStaffResource<AppointmentOptions>(
    staff ? "/admin/appointment-options" : null,
  );
  const query = new URLSearchParams({ page: String(page), page_size: "12" });
  let validation = "";
  try {
    const range = dateWindow(start, calendar ? nextDate(start, 6) : end);
    if (range.date_from) query.set("date_from", range.date_from);
    if (range.date_to) query.set("date_to", range.date_to);
  } catch (e) {
    validation = e instanceof Error ? e.message : "Choose valid date filters.";
  }
  if (status) query.set("status", status);
  if (staff && host) query.set("staff_id", host);
  if (staff && params.get("inquiry_id"))
    query.set("inquiry_id", params.get("inquiry_id")!);
  const result = useStaffResource<AppointmentSummary[]>(
    validation ? null : staff ? "/admin/appointments" : "/appointments",
    query.toString(),
  );
  let lastDay = "";
  return (
    <>
      <p className="inspection-eyebrow">
        {staff ? "KOFA WORKSPACE" : "YOUR NEXT CHAPTER"}
      </p>
      <h1>
        {calendar
          ? "Inspection calendar."
          : staff
            ? "Make room for a visit."
            : "Make room for a visit."}
      </h1>
      <p>
        {staff
          ? "Schedule from a qualified property inquiry."
          : "Your upcoming and previous inspections, in one place."}
      </p>
      {staff && (
        <nav className="inspection-links" aria-label="Inspection views">
          <Link href="/staff/inspections">List</Link>
          <Link href="/staff/calendar">Calendar</Link>
          <Link href="/staff/inquiries?status=qualified">
            Schedule from an inquiry
          </Link>
        </nav>
      )}
      <div className="inspection-filters">
        <Dropdown
          label="Inspection status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "", label: "All inspections" },
            ...appointmentStatuses.map((s) => ({ value: s, label: words(s) })),
          ]}
        />
        {staff && (
          <Dropdown
            label="Kof’a representative"
            value={host}
            options={[
              { value: "", label: "All team members" },
              ...(options.data?.staff ?? []).map((s) => ({
                value: s.id,
                label: s.full_name,
              })),
            ]}
            onChange={(e) => {
              setHost(e.target.value);
              setPage(1);
            }}
          />
        )}
        <Input
          label={calendar ? "Week starting (WAT)" : "From date (WAT)"}
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setPage(1);
          }}
        />
        {!calendar && (
          <Input
            label="To date (WAT)"
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setPage(1);
            }}
          />
        )}
      </div>
      {calendar && (
        <div className="inspection-links">
          <Button
            variant="secondary"
            disabled={!start || !!validation}
            onClick={() => {
              setStart(nextDate(start, -7));
              setPage(1);
            }}
          >
            Previous week
          </Button>
          <Button
            variant="secondary"
            disabled={!start || !!validation}
            onClick={() => {
              setStart(nextDate(start, 7));
              setPage(1);
            }}
          >
            Next week
          </Button>
        </div>
      )}
      {validation ? (
        <p role="alert">{validation}</p>
      ) : result.error ? (
        <p role="alert">
          {result.error instanceof Error
            ? result.error.message
            : "Unable to load inspections."}
        </p>
      ) : result.loading ? (
        <BrandLoading />
      ) : result.data?.length ? (
        result.data.map((row) => {
          const day = watInput(row.scheduled_at).date;
          const heading = calendar && day !== lastDay;
          lastDay = day;
          return (
            <section key={row.id}>
              {heading && (
                <h2 className="inspection-day">
                  {formatStaffDate(row.scheduled_at, "date")}
                </h2>
              )}
              <Link className="inspection-card" href={visitLink(staff, row.id)}>
                <strong>{row.property.title}</strong>
                <span>{formatStaffDate(row.scheduled_at)} WAT</span>
                <span>
                  {words(row.status)} · {row.staff_name}
                </span>
                <small>{row.reference}</small>
              </Link>
            </section>
          );
        })
      ) : (
        <div className="inspection-tint">
          <h2>No inspections here yet.</h2>
          <p>
            {staff
              ? "Open a qualified inquiry to propose a visit."
              : "Our team will propose a visit after discussing your inquiry."}
          </p>
          <Link href={staff ? "/staff/inquiries" : "/account/inquiries"}>
            Open inquiries
          </Link>
        </div>
      )}
      <Button variant="secondary" onClick={result.reload}>
        Refresh inspections
      </Button>
      <div className="inspection-pagination">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {Math.max(1, result.meta?.total_pages ?? 0)}
        </span>
        <Button
          variant="secondary"
          disabled={page >= (result.meta?.total_pages ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </>
  );
}
