// Manual mirror of API_CONTRACT 0.2.0 (Draft). Replace with OpenAPI output in FE-2.5.
export interface ApiEnvelope<T> {
  data: T;
}
export interface Pagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}
export interface PaginatedEnvelope<T> extends ApiEnvelope<T[]> {
  meta: Pagination;
}
export interface ApiErrorDetail {
  field: string;
  code: string;
  message: string;
}
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
    request_id: string;
  };
}
export interface Money {
  amount: number;
  currency: "NGN";
}
export type PricePeriod = "year" | "month" | "one_time";
export interface PropertyPrice extends Money {
  period: PricePeriod;
}
