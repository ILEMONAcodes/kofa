"use client";
import { useState } from "react";
import type { StaffDetail } from "@/types/staff-property";
import { Button } from "@/components/common/button";
import { Dropdown } from "@/components/common/dropdown";
import { Input } from "@/components/common/input";
import { Modal } from "@/components/common/modal";
import { formatStaffDate } from "@/lib/formatters/date";
import { words, priceText, StaffInputError } from "./model";
import { staffWrite } from "./data";
type Act = (job: () => Promise<string>) => Promise<boolean>;
type Props = { record: StaffDetail; act: Act; busy: boolean };
const option = (value: string, label = words(value)) => ({ value, label });
const codes = [
  "identity",
  "ownership_docs",
  "location",
  "price",
  "features",
  "availability",
];
export function WorkflowPanel({ record, act, busy }: Props) {
  const [action, setAction] = useState(""),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [failed, setFailed] = useState(false);
  const actions = record.allowed_actions ?? [];
  const workflows = record.allowed_workflows ?? [];
  const blockers = record.publication_blockers ?? [
    "Workflow service is unavailable. Reload after the backend is updated.",
  ];
  return (
    <section className="live-staff-panel">
      <h2>Review and publishing</h2>
      <p>Current status: {words(record.status)}</p>
      {!!blockers.length && (
        <div>
          <h3>Before approval or publication</h3>
          <ul>
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {actions.length ? (
        <>
          <Dropdown
            label="Listing action"
            value={action}
            disabled={busy}
            options={[
              option("", "Choose an action"),
              ...actions.map((v) => option(v)),
            ]}
            onChange={(e) => setAction(e.target.value)}
          />
          <Button
            disabled={busy || !action}
            onClick={() => {
              setFailed(false);
              setConfirm(true);
            }}
          >
            Continue with action
          </Button>
        </>
      ) : (
        <p>No listing transitions are available.</p>
      )}
      <Modal
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title={`${words(action)} this listing?`}
      >
        <form
          className="live-staff-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setFailed(false);
            void act(async () => {
              await staffWrite(
                `/admin/properties/${record.id}/transitions`,
                "POST",
                { action, reason: reason || null, version: record.version },
              );
              setConfirm(false);
              return `${words(action)} completed.`;
            }).then((ok) => {
              if (!ok) setFailed(true);
            });
          }}
        >
          <p>{record.title}</p>
          <Input
            label="Reason"
            value={reason}
            maxLength={2000}
            hint="Explain corrections, rejection, unpublishing or reopening. Required for those actions."
            onChange={(e) => setReason(e.target.value)}
          />
          {failed && (
            <p role="alert">
              This action could not be completed. Check the reason, or close
              this dialog and reload the listing.
            </p>
          )}
          <Button type="submit" loading={busy}>
            Confirm {words(action).toLowerCase()}
          </Button>
        </form>
      </Modal>
      {workflows.includes("save_verification") && (
        <VerificationForm record={record} act={act} busy={busy} />
      )}
      {workflows.includes("complete_verification") && (
        <div className="live-staff-actions">
          <Button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await staffWrite(
                  `/admin/properties/${record.id}/verification/complete`,
                  "POST",
                  { outcome: "passed", version: record.version },
                );
                return "Verification passed.";
              })
            }
          >
            Complete verification as passed
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await staffWrite(
                  `/admin/properties/${record.id}/verification/complete`,
                  "POST",
                  { outcome: "failed", version: record.version },
                );
                return "Verification recorded as failed.";
              })
            }
          >
            Record verification as failed
          </Button>
        </div>
      )}
      {workflows.includes("record_landlord_approval") && (
        <ApprovalForm record={record} act={act} busy={busy} />
      )}
    </section>
  );
}
function VerificationForm({ record, act, busy }: Props) {
  const current = record.verification_history.find((v) => v.is_current);
  const [method, setMethod] = useState(current?.method ?? "desk_review"),
    [scope, setScope] = useState(current?.scope_summary ?? "");
  const [checks, setChecks] = useState(
    codes.map((code) => {
      const saved = current?.checks.find((c) => c.code === code);
      return {
        code,
        result: saved?.result ?? "",
        note: saved?.note ?? "",
        evidence_document_id: saved?.evidence_document_id ?? "",
      };
    }),
  );
  function update(
    index: number,
    key: "result" | "note" | "evidence_document_id",
    value: string,
  ) {
    setChecks((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  }
  return (
    <form
      className="live-staff-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void act(async () => {
          await staffWrite(
            `/admin/properties/${record.id}/verification`,
            "PUT",
            {
              method,
              scope_summary: scope,
              version: record.version,
              checks: checks
                .filter((c) => c.result)
                .map((c) => ({
                  ...c,
                  note: c.note || null,
                  evidence_document_id: c.evidence_document_id || null,
                })),
            },
          );
          return "Verification checklist saved. Complete it when the review is finished.";
        });
      }}
    >
      <h3>Verification checklist</h3>
      <p>
        Verification records the checks performed. It does not guarantee legal
        ownership or title.
      </p>
      <Dropdown
        label="Verification method"
        value={method}
        options={["desk_review", "physical_inspection", "both"].map((v) =>
          option(v),
        )}
        onChange={(e) => setMethod(e.target.value)}
      />
      <Input
        label="Verification scope"
        required
        maxLength={2000}
        value={scope}
        hint="Describe the completed checks without private contact or document details. This scope may appear publicly."
        onChange={(e) => setScope(e.target.value)}
      />
      <div className="live-staff-grid">
        {checks.map((check, i) => (
          <fieldset key={check.code} className="live-staff-stack">
            <legend>{words(check.code)}</legend>
            <Dropdown
              label={`${words(check.code)} result`}
              value={check.result}
              options={[
                option("", "Not checked"),
                option("pass"),
                option("fail"),
                option("na", "Not applicable"),
              ]}
              onChange={(e) => update(i, "result", e.target.value)}
            />
            <Input
              label={`${words(check.code)} note`}
              required={check.result === "na"}
              maxLength={2000}
              value={check.note}
              onChange={(e) => update(i, "note", e.target.value)}
            />
            <Dropdown
              label={`${words(check.code)} evidence`}
              value={check.evidence_document_id}
              options={[
                option("", "No document reference"),
                ...record.documents.map((doc, n) =>
                  option(doc.id, `${words(doc.kind)} ${n + 1}`),
                ),
              ]}
              onChange={(e) =>
                update(i, "evidence_document_id", e.target.value)
              }
            />
          </fieldset>
        ))}
      </div>
      <Button type="submit" loading={busy}>
        Save verification checklist
      </Button>
    </form>
  );
}
function ApprovalForm({ record, act, busy }: Props) {
  const [method, setMethod] = useState("phone"),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [approvedAt, setApprovedAt] = useState("");
  return (
    <form
      className="live-staff-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void act(async () => {
          if (!confirmed)
            throw new StaffInputError(
              "Confirm the landlord approved the current price and description.",
            );
          const date = new Date(`${approvedAt}:00+01:00`);
          if (!Number.isFinite(date.getTime()))
            throw new StaffInputError("Enter a valid approval date and time.");
          await staffWrite(
            `/admin/properties/${record.id}/landlord-approval`,
            "POST",
            {
              approved_price: record.price,
              description_approved: true,
              method,
              note: note || null,
              approved_at: date.toISOString(),
              version: record.version,
            },
          );
          return "Landlord approval recorded.";
        });
      }}
    >
      <h3>Landlord confirmation</h3>
      <p>
        Current advertised price: {priceText(record.price.amount)} /{" "}
        {words(record.price.period)}
      </p>
      {record.landlord_approval && (
        <p>
          Last recorded {formatStaffDate(record.landlord_approval.approved_at)}.
        </p>
      )}
      <Dropdown
        label="Approval method"
        value={method}
        options={["phone", "whatsapp", "email", "in_person"].map((v) =>
          option(v),
        )}
        onChange={(e) => setMethod(e.target.value)}
      />
      <Input
        label="Approval date and time (WAT)"
        type="datetime-local"
        required
        value={approvedAt}
        onChange={(e) => setApprovedAt(e.target.value)}
      />
      <Input
        label="Approval note"
        maxLength={2000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          required
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />{" "}
        The landlord approved the current advertised price and description.
      </label>
      <Button type="submit" loading={busy}>
        Record landlord approval
      </Button>
    </form>
  );
}
