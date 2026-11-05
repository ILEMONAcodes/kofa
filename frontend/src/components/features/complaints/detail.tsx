"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/common/button";
import { Dropdown } from "@/components/common/dropdown";
import { Modal } from "@/components/common/modal";
import {
  useStaffResource,
  staffWrite,
} from "@/components/features/live-staff/data";
import { apiRequest } from "@/lib/api/client";
import type { CaseSummary, CaseDetail } from "@/types/complaint";
import { TextArea } from "./form";
import { dismissReasons, opts, outcomes, words } from "./model";
export function CaseDetailView({
  id,
  staff = false,
}: {
  id: string;
  staff?: boolean;
}) {
  const result = useStaffResource<CaseSummary | CaseDetail>(
    (staff ? "/admin/complaints/" : "/complaints/") + id,
  );
  if (result.loading) return <p role="status">Finding your concern…</p>;
  if (result.error || !result.data)
    return (
      <>
        <h1>Unable to open this case.</h1>
        <p role="alert">
          {result.error instanceof Error
            ? result.error.message
            : "The case is unavailable."}
        </p>
        <Button onClick={result.reload}>Try again</Button>
      </>
    );
  const row = result.data;
  return (
    <>
      <p className="inspection-eyebrow">
        {staff ? "KOFA WORKSPACE" : "YOUR NEXT CHAPTER"}
      </p>
      <h1>{staff ? "Review this concern." : "Your case, at a glance."}</h1>
      <section className="inspection-tint">
        <strong>{row.reference}</strong>
        <p>{words(row.status)}</p>
        <p>
          {row.public_note ??
            (["resolved", "dismissed"].includes(row.status)
              ? "Our team has reviewed this concern."
              : "Our team will review this concern before deciding on any action.")}
        </p>
      </section>
      {staff && "version" in row ? (
        <Investigation
          key={`${row.id}-${row.version}`}
          row={row}
          reload={result.reload}
        />
      ) : (
        <>
          <p>
            Investigation notes and other people’s information remain private.
          </p>
          <Link className="inspection-back" href="/account/complaints">
            My complaints
          </Link>
        </>
      )}
    </>
  );
}
function Investigation({
  row,
  reload,
}: {
  row: CaseDetail;
  reload: () => void;
}) {
  const [fileLinks, setFileLinks] = useState<Record<string, string>>({});
  const options = useStaffResource<{
    staff: { id: string; full_name: string }[];
  }>("/admin/complaint-options");
  const [assignee, setAssignee] = useState(row.assigned_staff_id ?? ""),
    [findings, setFindings] = useState(row.findings ?? ""),
    [reviewed, setReviewed] = useState(row.evidence_reviewed ?? ""),
    [outcome, setOutcome] = useState(row.outcome ?? "inconclusive"),
    [action, setAction] = useState(row.actions[0] ?? "no_action"),
    [note, setNote] = useState(row.public_note ?? ""),
    [reason, setReason] = useState(""),
    [dismiss, setDismiss] = useState("insufficient_information"),
    [dialog, setDialog] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function write(operation: string, body: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await staffWrite(
        `/admin/complaints/${row.id}/${operation}`,
        operation === "investigation" ? "PUT" : "POST",
        { version: row.version, ...(body as object) },
      );
      reload();
      setDialog("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save case.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function openFile(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await apiRequest<{ url: string; expires_at: number }>(
        `/admin/complaints/${row.id}/files/${id}`,
      );
      setFileLinks((old) => ({ ...old, [id]: r.data.url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open evidence.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <section className="inspection-card">
        <h2>Submitted concern</h2>
        <p>
          {words(row.kind)}
          {row.reason ? ` · ${words(row.reason)}` : ""}
        </p>
        <p>{row.description}</p>
        {row.desired_outcome && (
          <p>Requested resolution: {row.desired_outcome}</p>
        )}
        <p>
          {row.other_open_reports} other open reports for this property. Counts
          never trigger an action.
        </p>
      </section>
      <section className="inspection-card">
        <h2>Confidential reporter</h2>
        <p>{row.reporter.name ?? "Name not provided"}</p>
        <p>{row.reporter.email ?? "Email not provided"}</p>
        <p>{row.reporter.phone ?? "Phone not provided"}</p>
        <p>Never share these details with the reported party.</p>
      </section>
      {row.hold_review_due_at && (
        <section className="inspection-tint">
          <h2>Precautionary hold</h2>
          <p>
            Review by{" "}
            {new Date(row.hold_review_due_at).toLocaleString("en-NG", {
              timeZone: "Africa/Lagos",
            })}{" "}
            WAT. Releasing this hold does not republish the property.
          </p>
        </section>
      )}
      {row.property_id && (
        <Link href={`/staff/property?id=${row.property_id}`}>
          Open related property
        </Link>
      )}
      <section className="inspection-stack">
        <h2>Private evidence</h2>
        {row.evidence.length === 0 && <p>No evidence files attached.</p>}
        {row.evidence.map((e, i) => (
          <div key={e.id} className="inspection-stack">
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => openFile(e.id)}
            >
              Open evidence {i + 1} · {e.mime_type}
            </Button>
            {fileLinks[e.id] && (
              <a
                href={fileLinks[e.id]}
                target="_blank"
                rel="noopener noreferrer"
              >
                View evidence {i + 1} · Link valid for five minutes
              </a>
            )}
          </div>
        ))}
      </section>
      {!["resolved", "dismissed"].includes(row.status) && (
        <form
          className="inspection-form"
          onSubmit={(e) => {
            e.preventDefault();
            void write("assign", { staff_id: assignee });
          }}
        >
          <fieldset disabled={busy}>
            <Dropdown
              label="Assigned team member"
              options={[
                { value: "", label: "Choose team member" },
                ...(options.data?.staff ?? []).map((s) => ({
                  value: s.id,
                  label: s.full_name,
                })),
              ]}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy || !assignee}>
              Assign case
            </Button>
          </fieldset>
        </form>
      )}
      {row.status === "investigating" && (
        <form
          className="inspection-form"
          onSubmit={(e) => {
            e.preventDefault();
            void write("investigation", {
              findings,
              evidence_reviewed: reviewed,
              outcome,
              actions: [action],
              public_note: note || null,
            });
          }}
        >
          <h2>Build a supported conclusion.</h2>
          <p>
            Findings, evidence, outcome and actions are required before
            resolution.
          </p>
          <fieldset disabled={busy}>
            <TextArea
              label="Findings"
              value={findings}
              onChange={setFindings}
              maxLength={8000}
              required
            />
            <TextArea
              label="Evidence reviewed"
              value={reviewed}
              onChange={setReviewed}
              required
            />
            <Dropdown
              label="Outcome"
              options={opts(outcomes)}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
            <Dropdown
              label="Actions"
              options={opts(row.allowed_case_actions)}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
            <TextArea
              label="Public note (optional)"
              value={note}
              onChange={setNote}
              maxLength={1000}
            />
            <section className="inspection-tint">
              <strong>Permission safeguards</strong>
              <p>
                Permanent listing rejection or landlord blocking is admin-only
                and requires substantiated findings. Saving stages the action;
                resolving executes it.
              </p>
              <p>
                Public notes must be generic: do not include contact details,
                identifying evidence or private findings.
              </p>
            </section>
            <Button disabled={busy} type="submit">
              Save working record
            </Button>
          </fieldset>
        </form>
      )}
      <div className="inspection-actions">
        {row.allowed_actions.map((a) => (
          <Button
            key={a}
            disabled={busy}
            variant={a === "dismiss" ? "secondary" : "primary"}
            onClick={() => {
              setDialog(a);
              setReason("");
            }}
          >
            {words(a)}
          </Button>
        ))}
      </div>
      <section className="inspection-card">
        <h2>Case history</h2>
        {row.events.map((e, i) => (
          <p key={i}>
            {words(e.note)} ·{" "}
            {new Date(e.created_at).toLocaleString("en-NG", {
              timeZone: "Africa/Lagos",
            })}
          </p>
        ))}
      </section>
      <Modal
        open={!!dialog}
        onClose={() => {
          if (!busy) setDialog("");
        }}
        title={words(dialog)}
      >
        <form
          className="inspection-form"
          onSubmit={(e) => {
            e.preventDefault();
            void write("transitions", {
              action: dialog,
              reason: reason || null,
              dismiss_reason: dialog === "dismiss" ? dismiss : null,
            });
          }}
        >
          <fieldset disabled={busy}>
            <p>
              {dialog === "resolve"
                ? "Resolve this case and execute the saved actions? Permanent actions require substantiated findings."
                : "Confirm this case action. It will be recorded in the case history."}
            </p>
            {dialog === "dismiss" && (
              <Dropdown
                label="Dismissal reason"
                options={opts(dismissReasons)}
                value={dismiss}
                onChange={(e) => setDismiss(e.target.value)}
              />
            )}{" "}
            {["place_hold", "release_hold", "reopen"].includes(dialog) && (
              <TextArea
                label="Reason for action"
                value={reason}
                onChange={setReason}
                maxLength={2000}
                required
              />
            )}
            <Button type="submit" disabled={busy}>
              Confirm {words(dialog)}
            </Button>
            {error && <p role="alert">{error}</p>}
          </fieldset>
        </form>
      </Modal>
    </>
  );
}
