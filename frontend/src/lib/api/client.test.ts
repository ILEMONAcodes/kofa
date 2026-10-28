import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
afterEach(() => vi.unstubAllGlobals());
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-ID": "req-1" },
  });
describe("API transport", () => {
  it("unwraps the success envelope without dropping metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ data: [], meta: { total_items: 0 } })),
    );
    expect(await apiRequest("/properties")).toEqual({
      data: [],
      meta: { total_items: 0 },
    });
  });
  it("preserves future codes and field errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json(
            {
              error: {
                code: "FUTURE_CODE",
                message: "Try another value",
                request_id: "req-new",
                details: [
                  {
                    field: "price.amount",
                    code: "future",
                    message: "Out of range",
                  },
                ],
              },
            },
            422,
          ),
        ),
    );
    await expect(apiRequest("/properties")).rejects.toMatchObject({
      status: 422,
      code: "FUTURE_CODE",
      message: "Try another value",
      requestId: "req-new",
      details: [
        { field: "price.amount", code: "future", message: "Out of range" },
      ],
    });
  });
  it("handles HTML proxy failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>Proxy error</html>", {
            status: 502,
            headers: { "X-Request-ID": "proxy-1" },
          }),
        ),
    );
    await expect(apiRequest("/health")).rejects.toMatchObject({
      status: 502,
      code: "UPSTREAM_ERROR",
      requestId: "proxy-1",
    });
  });
  it("handles network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(apiRequest("/health")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 0,
    });
  });
  it("handles timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          ),
      ),
    );
    await expect(apiRequest("/health", { timeoutMs: 1 })).rejects.toMatchObject(
      { code: "TIMEOUT" },
    );
  });
  it("rejects malformed success envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ wrong: [] })));
    await expect(apiRequest("/health")).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
    });
  });
  it("refreshes once and retries an expired session", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({ error: { code: "TOKEN_EXPIRED", message: "Expired" } }, 401),
      )
      .mockResolvedValueOnce(json({ data: {} }))
      .mockResolvedValueOnce(json({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetcher);
    expect(await apiRequest("/health")).toEqual({ data: { ok: true } });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toBe("/api/v1/auth/refresh");
  });
  it("stops after a single refresh", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          json({ error: { code: "TOKEN_EXPIRED", message: "Expired" } }, 401),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(apiRequest("/health")).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("adds CSRF to unsafe requests", async () => {
    document.cookie = "csrf_token=sample-token";
    const fetcher = vi.fn().mockResolvedValue(json({ data: {} }));
    vi.stubGlobal("fetch", fetcher);
    await apiRequest("/auth/login", {
      method: "POST",
      body: { email: "sample@example.com" },
    });
    expect(fetcher.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe(
      "sample-token",
    );
    document.cookie = "csrf_token=; max-age=0";
  });
});

it("serializes comma-separated filters and kobo bounds", async () => {
  const fetcher = vi.fn().mockResolvedValue(json({ data: [] }));
  vi.stubGlobal("fetch", fetcher);
  await apiRequest("/properties", {
    query: {
      property_type: ["apartment", "duplex"],
      price_min: 10000000,
      city: "Abuja",
    },
  });
  const url = new URL(fetcher.mock.calls[0][0], "http://localhost");
  expect(url.searchParams.get("property_type")).toBe("apartment,duplex");
  expect(url.searchParams.get("price_min")).toBe("10000000");
});
it("does not refresh for other 401 codes", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      json({ error: { code: "UNAUTHENTICATED", message: "Sign in" } }, 401),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(apiRequest("/health")).rejects.toMatchObject({
    status: 401,
    code: "UNAUTHENTICATED",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
