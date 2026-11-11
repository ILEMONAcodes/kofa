export interface OperationalReport {
  as_of: string;
  period: { from_date: string | null; to_date: string | null; timezone: "Africa/Lagos" };
  counts: {
    listings_awaiting_review: number;
    open_inquiries: number;
    upcoming_inspections: number;
    active_complaints: number;
  };
}
