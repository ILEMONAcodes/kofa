import type { NextConfig } from "next";
const origin = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";
const parsed = new URL(origin);
if (
  !["http:", "https:"].includes(parsed.protocol) ||
  parsed.username ||
  parsed.password ||
  parsed.pathname !== "/" ||
  parsed.search ||
  parsed.hash
) {
  throw new Error(
    "API_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment.",
  );
}
const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${parsed.origin}/api/v1/:path*`,
      },
    ];
  },
};
export default config;
