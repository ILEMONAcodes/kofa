import { ApiError } from "./error";
import type { ApiEnvelope, ApiErrorDetail } from "@/types/api";
type Options = Omit<RequestInit, "body" | "signal"> & {
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  query?: Record<
    string,
    string | number | boolean | readonly string[] | undefined
  >;
};
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
function csrf(): string | undefined {
  if (typeof document === "undefined") return;
  const cookie = document.cookie
    .split("; ")
    .find((value) => value.startsWith("csrf_token="));
  if (!cookie) return;
  try {
    return decodeURIComponent(cookie.slice("csrf_token=".length));
  } catch {
    return;
  }
}
function details(v: unknown): ApiErrorDetail[] {
  return Array.isArray(v)
    ? v.filter(
        (x): x is ApiErrorDetail =>
          record(x) &&
          typeof x.field === "string" &&
          typeof x.code === "string" &&
          typeof x.message === "string",
      )
    : [];
}
// Browser-only same-origin client. Server adapters must supply their own per-request cookies.
export async function apiRequest<T>(
  path: string,
  options: Options = {},
): Promise<ApiEnvelope<T>> {
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path))
    throw new Error("Use a relative API path without a query or fragment.");
  const { timeoutMs = 10000, signal, body, query, ...init } = options;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {}))
    if (value !== undefined)
      search.set(key, Array.isArray(value) ? value.join(",") : String(value));
  const target = search.size ? `${path}?${search}` : path;
  async function perform(
    target: string,
    request: typeof init,
    payload?: unknown,
  ): Promise<{ response: Response; payload: unknown; invalidJson: boolean }> {
    const headers = new Headers(request.headers);
    headers.set("Accept", "application/json");
    if (payload !== undefined) headers.set("Content-Type", "application/json");
    const method = request.method?.toUpperCase() ?? "GET";
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const token = csrf();
      if (token) headers.set("X-CSRF-Token", token);
    }
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(`/api/v1${target}`, {
        ...request,
        headers,
        credentials: "same-origin",
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: controller.signal,
      });
      if (response.status === 204)
        return { response, payload: undefined, invalidJson: false };
      const text = await response.text(); // timeout also covers the response body
      try {
        return {
          response,
          payload: JSON.parse(text) as unknown,
          invalidJson: false,
        };
      } catch {
        return { response, payload: undefined, invalidJson: true };
      }
    } catch {
      throw new ApiError(
        0,
        timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        timedOut
          ? "The request took too long. Please try again."
          : "Unable to connect. Please try again.",
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  async function decode({
    response,
    payload,
    invalidJson,
  }: {
    response: Response;
    payload: unknown;
    invalidJson: boolean;
  }): Promise<ApiEnvelope<T>> {
    if (response.status === 204) return { data: undefined as T };
    if (invalidJson) {
      throw new ApiError(
        response.status,
        "UPSTREAM_ERROR",
        "The service returned an unexpected response. Please try again.",
        response.headers.get("X-Request-ID") ?? undefined,
      );
    }
    if (!response.ok) {
      const error =
        record(payload) && record(payload.error) ? payload.error : undefined;
      if (!error || typeof error.code !== "string")
        throw new ApiError(
          response.status,
          "UPSTREAM_ERROR",
          "The service returned an unexpected response. Please try again.",
          response.headers.get("X-Request-ID") ?? undefined,
        );
      throw new ApiError(
        response.status,
        error.code,
        typeof error.message === "string" && error.message.trim()
          ? error.message
          : "Something went wrong. Please try again.",
        typeof error.request_id === "string"
          ? error.request_id
          : (response.headers.get("X-Request-ID") ?? undefined),
        details(error.details),
      );
    }
    if (!record(payload) || !("data" in payload))
      throw new ApiError(
        response.status,
        "UPSTREAM_ERROR",
        "The service returned an unexpected response. Please try again.",
      );
    // Transport-envelope validation only; generated schemas/runtime resource validation follow in FE-2.5.
    return payload as unknown as ApiEnvelope<T>;
  }
  try {
    return await decode(await perform(target, init, body));
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      error.code !== "TOKEN_EXPIRED" ||
      path === "/auth/refresh"
    )
      throw error;
    const refresh = await perform("/auth/refresh", { method: "POST" });
    if (!refresh.response.ok) await decode(refresh);
    return decode(await perform(target, init, body)); // one retry only; navigation remains a UI responsibility
  }
}
