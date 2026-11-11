"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, buttonStyles } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { BrandLoading } from "@/components/common/brand-loading";
import { InspectionFrame } from "@/components/features/inspections/frame";
import { useStaffResource, staffWrite } from "@/components/features/live-staff/data";
import { errorText, words } from "@/components/features/live-staff/model";
import { formatStaffDate } from "@/lib/formatters/date";

export interface AvailabilityItem {
  id: string; title: string; listing_type: "rent" | "sale";
  availability_status: string; last_confirmed_at: string | null;
  version: number; assigned_staff: string | null;
}
interface Confirmation {
  id: string; recorded_at: string; confirmed_at: string | null;
  actor_name: string | null; outcome: string | null;
  availability_status: string | null; note: string | null;
}
export const outcomes = (type: string) => [
  { value: "available", label: "Available" },
  { value: "under_offer", label: "Under offer" },
  { value: type === "rent" ? "let" : "sold", label: type === "rent" ? "Let" : "Sold" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "unavailable", label: "Unavailable (other)" },
];

export function AvailabilityHistory({ id }: { id: string }) {
  const result = useStaffResource<Confirmation[]>(`/admin/properties/${encodeURIComponent(id)}/availability-history`);
  return <section className="live-staff-panel" aria-label="Confirmation history">
    <h2>Confirmation history</h2>
    {result.loading ? <BrandLoading /> : result.error ? <><p role="alert">{errorText(result.error)}</p><Button onClick={result.reload}>Retry history</Button></> : !result.data?.length ? <p>No recorded confirmations yet.</p> : <ul className="live-staff-stack">{result.data.map(row => <li key={row.id}>
      <p>{words(row.outcome ?? row.availability_status ?? "confirmed")} · {row.actor_name ?? "Former team member"}</p>
      <p>Recorded {formatStaffDate(row.recorded_at)}</p>
      {row.confirmed_at && <p>Confirmed {formatStaffDate(row.confirmed_at)}</p>}
      {row.note && <p>{row.note}</p>}
    </li>)}</ul>}
  </section>;
}
function Card({ item, saved }: { item: AvailabilityItem; saved: () => void }) {
  const [selected, setSelected] = useState(item.availability_status);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await staffWrite(`/admin/properties/${item.id}/availability`, "PATCH", { outcome: selected, note, version: item.version });
      saved();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  return <section className="live-staff-panel" aria-label={item.title}>
    <h2>{item.title}</h2>
    <p>{item.last_confirmed_at ? `Last confirmed ${formatStaffDate(item.last_confirmed_at)}` : "Never confirmed"}</p>
    <p>Assigned to {item.assigned_staff ?? "the team (unassigned)"}</p>
    <form className="live-staff-stack" onSubmit={confirm}>
      <Dropdown label="Confirmation outcome" value={selected} options={outcomes(item.listing_type)} onChange={e => setSelected(e.target.value)} />
      <Input label="Confirmation note (optional)" value={note} maxLength={1000} onChange={e => setNote(e.target.value)} />
      <p>Confirm with the owner before saving. Your name and the current confirmation time are recorded.</p>
      {error && <p role="alert">{error}</p>}
      <Button type="submit" loading={busy}>Save confirmation</Button>
    </form>
    <Link className={buttonStyles("secondary")} href={`/staff/availability-history?id=${item.id}`}>View confirmation history</Link>
  </section>;
}
export function AvailabilityQueue() {
  const [page, setPage] = useState(1), [search, setSearch] = useState(""), [q, setQ] = useState("");
  const [message, setMessage] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const query = new URLSearchParams({ page: String(page), ...(q ? { q } : {}) }).toString();
  const result = useStaffResource<AvailabilityItem[]>("/admin/availability-queue", query);
  const meta = result.meta as (typeof result.meta & { threshold_days: number }) | undefined;
  return <InspectionFrame staff><div className="operational-dashboard">
    <h1>Keep availability up to date.</h1>
    <p>Published listings that have never been confirmed, or were last confirmed more than {meta?.threshold_days ?? "the configured number of"} days ago. Listings are not automatically unpublished.</p>
    <form className="live-staff-panel" onSubmit={e => { e.preventDefault(); setPage(1); setQ(search); }}>
      <Input label="Search availability queue" value={search} maxLength={150} onChange={e => setSearch(e.target.value)} />
      <Button type="submit">Search listings</Button>
    </form>
    <Button variant="secondary" onClick={() => { setMessage(""); result.reload(); }}>Refresh queue</Button>
    {message && <p role="status">{message}</p>}
    {savedId && <Link href={`/staff/availability-history?id=${savedId}`}>View saved confirmation</Link>}
    {result.loading ? <BrandLoading /> : result.error ? <><p role="alert">{errorText(result.error)}</p><Button onClick={result.reload}>Try again</Button></> : !result.data?.length ? <p>{result.meta?.total_items ? "No listings on this page. Return to the previous page." : "No listings need reconfirmation."}</p> : <>
      <p>{result.meta?.total_items} {result.meta?.total_items === 1 ? "listing needs" : "listings need"} reconfirmation.</p>
      {result.data.map(item => <Card key={`${item.id}-${item.version}`} item={item} saved={() => { setMessage("Availability confirmation saved."); setSavedId(item.id); setPage(1); result.reload(); }} />)}
    </>}
    <div className="live-staff-actions">
      <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Previous</Button>
      <span>Page {page}</span>
      <Button variant="secondary" disabled={!result.meta || page >= result.meta.total_pages} onClick={() => setPage(p => p+1)}>Next</Button>
    </div>
    <Link href="/staff/overview">Back to overview</Link>
  </div></InspectionFrame>;
}


export function AvailabilityHistoryPage({ id }: { id: string | null }) {
  return <InspectionFrame staff><div className="operational-dashboard">
    <h1>Availability confirmation history</h1>
    {id ? <AvailabilityHistory id={id} /> : <p>Choose a listing from the availability queue.</p>}
    <Link className={buttonStyles()} href="/staff/availability-queue">Back to availability queue</Link>
  </div></InspectionFrame>;
}
