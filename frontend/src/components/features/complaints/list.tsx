"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/common/button";
import { Dropdown } from "@/components/common/dropdown";
import { Input } from "@/components/common/input";
import { useStaffResource } from "@/components/features/live-staff/data";
import type { CaseSummary } from "@/types/complaint";
import { caseLink, opts, statuses, words } from "./model";
export function CaseList({ staff = false }: { staff?: boolean }) {
  const [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const search = new URLSearchParams({ page: String(page) });
  if (status) search.set("status", status);
  if (staff && kind) search.set("kind", kind);
  if (staff && query) search.set("q", query);
  const result = useStaffResource<CaseSummary[]>(
    staff ? "/admin/complaints" : "/complaints",
    search.toString(),
  );
  return (
    <>
      <p className="inspection-eyebrow">
        {staff ? "KOFA WORKSPACE" : "YOUR NEXT CHAPTER"}
      </p>
      <h1>
        {staff
          ? "Every concern deserves a review."
          : "Your concerns, followed through."}
      </h1>
      <p>
        {staff
          ? "Treat reports as unverified until investigated. Reporter details stay private."
          : "Follow the status of your concerns and updates from our team."}
      </p>
      {!staff && (
        <Link href="/account/complaint-form" className="inspection-back">
          Raise a concern
        </Link>
      )}
      <Dropdown
        label="Case status"
        options={[{ value: "", label: "All statuses" }, ...opts(statuses)]}
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      />
      {staff && (
        <>
          <Dropdown
            label="Case kind"
            options={[
              { value: "", label: "All kinds" },
              ...opts([
                "suspicious_listing",
                "dispute",
                "service_complaint",
                "other",
              ]),
            ]}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Search case reference"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </>
      )}
      <Button variant="secondary" onClick={result.reload}>
        Refresh cases
      </Button>
      {result.loading && <p role="status">Finding your cases…</p>}
      {result.error != null && (
        <p role="alert">
          {result.error instanceof Error
            ? result.error.message
            : "Unable to load cases."}
        </p>
      )}
      {result.data?.length === 0 && <p>No concerns match these filters.</p>}
      {result.data?.map((c) => (
        <Link
          className="inspection-card"
          href={caseLink(staff, c.id)}
          key={c.id}
        >
          <strong>{c.reference}</strong>
          <span>
            {words(c.kind)} · {words(c.status)}
          </span>
          <time dateTime={c.created_at}>
            {new Date(c.created_at).toLocaleDateString("en-NG", {
              timeZone: "Africa/Lagos",
            })}
          </time>
          {c.public_note && <p>{c.public_note}</p>}
        </Link>
      ))}
      <div className="inspection-actions">
        <Button
          variant="secondary"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous page
        </Button>
        <p>
          Page {page}
          {result.meta ? ` of ${Math.max(1, result.meta.total_pages)}` : ""}
        </p>
        <Button
          disabled={!result.meta || page >= result.meta.total_pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next page
        </Button>
      </div>
    </>
  );
}
