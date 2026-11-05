export type CaseStatus =
  | "new"
  | "triage"
  | "investigating"
  | "resolved"
  | "dismissed";
export interface CaseSummary {
  id: string;
  reference: string;
  kind: string;
  status: CaseStatus;
  created_at: string;
  public_note: string | null;
}
export interface CaseReceipt {
  id: string;
  reference: string;
  status: "new";
  upload_token: string;
  upload_token_expires_at: string;
  message: string;
}
export interface CaseEvidence {
  id: string;
  mime_type: string;
  size_bytes: number;
}
export interface CaseDetail extends CaseSummary {
  reason: string | null;
  description: string;
  reporter: { name: string | null; email: string | null; phone: string | null };
  reporter_user_id: string | null;
  property_id: string | null;
  appointment_id: string | null;
  occurred_on: string | null;
  desired_outcome: string | null;
  assigned_staff_id: string | null;
  findings: string | null;
  evidence_reviewed: string | null;
  outcome: string | null;
  actions: string[];
  dismiss_reason: string | null;
  hold_review_due_at: string | null;
  version: number;
  other_open_reports: number;
  evidence: CaseEvidence[];
  events: {
    from_status: string | null;
    to_status: string;
    note: string;
    created_at: string;
  }[];
  allowed_actions: string[];
  allowed_case_actions: string[];
}
