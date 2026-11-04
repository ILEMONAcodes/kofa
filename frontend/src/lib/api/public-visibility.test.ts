import { describe, it, expect, vi, afterEach } from "vitest";
import { propertyVisibility } from "./public-visibility";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("public listing pre-render visibility", () => {
  it("checks an encoded slug without identity headers or cached state", async () => {
    vi.stubEnv("API_ORIGIN", "http://127.0.0.1:8000");
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await propertyVisibility("home with space")).toBe(200);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(
      "http://127.0.0.1:8000/api/v1/properties/home%20with%20space",
    );
    expect(options.cache).toBe("no-store");
    expect(options.headers).toBeUndefined();
  });
  it("retains the backend not-found status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 404 })),
    );
    expect(await propertyVisibility("withdrawn-home")).toBe(404);
  });
  it("treats a network failure as unavailable rather than falsely declaring a missing home", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await propertyVisibility("home")).toBe(503);
  });
});
