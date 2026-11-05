import type { Pagination } from "./api";
export type InquiryStatus =
  | "new"
  | "in_progress"
  | "qualified"
  | "inspection_scheduled"
  | "negotiating"
  | "closed_won"
  | "closed_lost"
  | "spam";
export const inquiryStatuses: InquiryStatus[] = [
  "new",
  "in_progress",
  "qualified",
  "inspection_scheduled",
  "negotiating",
  "closed_won",
  "closed_lost",
  "spam",
];
export type InquirySummary = {
  unread_count: number;
  id: string;
  reference: string;
  kind: string;
  status: InquiryStatus;
  property: { id: string; slug: string | null; title: string } | null;
  budget_min: number | null;
  budget_max: number | null;
  desired_move_in: string | null;
  created_at: string;
  updated_at: string;
  last_client_message_at: string | null;
  last_staff_message_at: string | null;
};
export type InquiryMessage = {
  id: string;
  body: string;
  sender_role: "client" | "staff";
  created_at: string;
};
export type InquiryNote = { id: string; body: string; created_at: string };
export type InquiryClient = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
};
export type InquiryDetail = InquirySummary & {
  client: InquiryClient;
  assigned_staff: { id: string; full_name: string } | null;
  version: number;
  closed_reason: string | null;
  allowed_actions: string[];
  history: {
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
  }[];
};
export type InquiryClientDetail = InquiryClient & {
  inquiries: InquirySummary[];
  inquiry_count: number;
};
export type Paged<T> = { data: T[]; meta: Pagination };
