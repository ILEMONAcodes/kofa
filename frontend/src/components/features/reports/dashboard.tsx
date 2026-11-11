"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useLocalAccess } from "@/components/access/local-access";
import { Button, buttonStyles } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { BrandLoading } from "@/components/common/brand-loading";
import { InspectionFrame } from "@/components/features/inspections/frame";
import { useStaffResource } from "@/components/features/live-staff/data";
import { errorText } from "@/components/features/live-staff/model";
import { formatStaffDate } from "@/lib/formatters/date";
import type { OperationalReport } from "@/types/report";

const metrics = [
  {
    key: "listings_awaiting_review",
    label: "Listings awaiting review",
    definition: "Submitted or in review. Filtered by submission date.",
    href: "/staff/properties",
    action: "Open property queue",
  },
  {
    key: "open_inquiries",
    label: "Open inquiries",
    definition:
      "New, in progress, qualified, inspection scheduled or negotiating. Filtered by inquiry creation date.",
    href: "/staff/inquiries",
    action: "Open inquiries",
  },
  {
    key: "upcoming_inspections",
    label: "Upcoming inspections",
    definition:
      "Proposed, confirmed or reschedule requested, starting now or later. Filtered by inspection date.",
    href: "/staff/inspections",
    action: "Open inspections",
  },
  {
    key: "active_complaints",
    label: "Active complaints",
    definition: "New, triage or investigating. Filtered by complaint creation date.",
    href: "/staff/complaints",
    action: "Open complaints",
  },
] as const;

export function OperationalDashboard({ reports = false }: { reports?: boolean }) {
  const { user, role } = useLocalAccess();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [validation, setValidation] = useState("");
  const result = useStaffResource<OperationalReport>("/admin/reports/kpis", query);

  function apply(event: FormEvent) {
    event.preventDefault();
    if ((!from !== !to) || (from && to && from > to)) {
      setValidation("Choose both dates, with the end date on or after the start date.");
      return;
    }
    setValidation("");
    const next = from && to ? new URLSearchParams({ from, to }).toString() : "";
    if (next === query) result.reload();
    else setQuery(next);
  }

  function clear() {
    setFrom("");
    setTo("");
    setValidation("");
    if (!query) result.reload();
    else setQuery("");
  }

  const data = result.data;
  return (
    <div className="operational-dashboard">
      <h1>
        {reports
          ? "Measure the work that matters."
          : `Welcome${user?.full_name ? ", " + user.full_name.trim().split(/\s+/)[0] : ""}.`}
      </h1>
      <p>A clear view of your workspace.</p>
      <form
        onSubmit={apply}
        className="live-staff-panel"
        aria-label="Dashboard date filters"
      >
        <h2>Date range</h2>
        <p>Dates use Africa/Lagos time. Leave both empty for all dates.</p>
        <div className="live-staff-grid">
          <Input
            label="From date"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input
            label="To date"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        {validation && <p role="alert">{validation}</p>}
        <div className="live-staff-actions">
          <Button type="submit">Apply dates</Button>
          <Button variant="secondary" type="button" onClick={clear}>
            All dates
          </Button>
          <Button variant="secondary" type="button" onClick={result.reload}>
            Refresh counts
          </Button>
        </div>
      </form>
      <p>
        Current workload for the selected dates, rather than a historical snapshot.
        Upcoming inspections exclude visits that have already started.
      </p>
      {result.loading ? (
        <BrandLoading />
      ) : result.error ? (
        <section className="live-staff-panel" role="alert">
          <p>{errorText(result.error)}</p>
          <Button onClick={result.reload}>Try again</Button>
        </section>
      ) : data ? (
        <div aria-live="polite" aria-busy={false}>
          <p>
            {data.period.from_date
              ? `${data.period.from_date} to ${data.period.to_date}`
              : "All dates"}{" "}
            · Africa/Lagos
          </p>
          <p>Updated {formatStaffDate(data.as_of)}</p>
          {Object.values(data.counts).every((value) => value === 0) && (
            <p role="status">No matching work to show for these dates.</p>
          )}
          <div className="live-staff-grid">
            {metrics.map((metric) => (
              <section
                key={metric.key}
                className="live-staff-panel"
                aria-label={metric.label}
              >
                <h2>{metric.label}</h2>
                <h3
                  className="text-3xl font-medium text-primary"
                  aria-label={`${metric.label}: ${data.counts[metric.key]}`}
                >
                  {data.counts[metric.key].toLocaleString("en-NG")}
                </h3>
                <p>{metric.definition}</p>
                <Link className={buttonStyles("secondary")} href={metric.href}>
                  {metric.action}
                </Link>
              </section>
            ))}
          </div>
        </div>
      ) : null}
      <div className="live-staff-actions">
        <Link className={buttonStyles()} href="/staff/availability-queue">Review availability</Link>
        <Link className={buttonStyles("secondary")} href="/staff/landlords">
          Landlord directory
        </Link>
        {role === "admin" && (
          <Link className={buttonStyles()} href="/admin/administration">
            Administration and team
          </Link>
        )}
      </div>
    </div>
  );
}

export function AdminReports({ reports = false }: { reports?: boolean }) {
  return (
    <InspectionFrame staff>
      <OperationalDashboard reports={reports} />
    </InspectionFrame>
  );
}
