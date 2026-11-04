import "server-only";
import { cache } from "react";
import type { PropertySummary, PropertyDetail } from "@/types/property";
import type { Taxonomy } from "@/types/filters";
export interface PublicPage {
  data: PropertySummary[];
  meta: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}
export type PublicResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string; requestId?: string };
async function get<T>(path: string): Promise<PublicResult<T>> {
  try {
    const response = await fetch(
      `${(process.env.API_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/$/, "")}/api/v1${path}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    const body = await response.json();
    if (!response.ok)
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 422
            ? "These search preferences are invalid. Clear the filters and try again."
            : "Properties are unavailable right now. Please try again.",
        requestId: response.headers.get("X-Request-ID") ?? undefined,
      };
    return { ok: true, value: body as T };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "Properties are unavailable right now. Please try again.",
    };
  }
}
export const publicSearch = (query: string) =>
  get<PublicPage>(`/properties${query ? `?${query}` : ""}`);
export const publicTaxonomy = () => get<{ data: Taxonomy }>("/taxonomy");
export const publicDetail = cache((slug: string) =>
  get<{ data: PropertyDetail }>(`/properties/${encodeURIComponent(slug)}`),
);
