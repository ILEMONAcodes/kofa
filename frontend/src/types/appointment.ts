import type { InquiryClient } from "./inquiry";
export const appointmentStatuses = [
  "proposed",
  "confirmed",
  "reschedule_requested",
  "completed",
  "cancelled_by_client",
  "cancelled_by_staff",
  "cancelled_by_landlord",
  "no_show",
] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];
export type InspectionFee = {
  amount: 0;
  currency: "NGN";
  status: "none";
  disclosure: string;
};
export type AppointmentSummary = {
  id: string;
  reference: string;
  inquiry_id: string;
  property: { id: string; slug: string | null; title: string };
  staff_name: string;
  scheduled_at: string;
  ends_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  version: number;
  fee: InspectionFee;
  allowed_actions: string[];
  requested_scheduled_at: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
};
export type ClientAppointment = AppointmentSummary & {
  meeting_address: string | null;
  meeting_instructions: string | null;
};
export type StaffAppointment = AppointmentSummary & {
  confirmed_meeting_address: string | null;
  client: InquiryClient;
  staff_id: string;
  address_line: string;
  landlord_rep_name: string | null;
  landlord_rep_phone: string | null;
  meeting_instructions: string | null;
  address_disclosed_at: string | null;
  reschedule_reason: string | null;
  cancellation_reason: string | null;
  outcome_notes: string | null;
  history: {
    from_status: string | null;
    to_status: string;
    reason: string | null;
    created_at: string;
  }[];
};
export type AppointmentOptions = {
  staff: { id: string; full_name: string }[];
  fee: InspectionFee;
};
