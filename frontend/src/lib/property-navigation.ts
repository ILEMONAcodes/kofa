// Only a relative search URL is accepted. Never forward an arbitrary return destination.
export function safePropertiesReturn(value: string | undefined): string {
  if (
    !value ||
    !/^\/properties(?:\?|$)/.test(value) ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return "/properties";
  try {
    const url = new URL(value, "https://kofa.invalid");
    return url.origin === "https://kofa.invalid" &&
      url.pathname === "/properties"
      ? `${url.pathname}${url.search}`
      : "/properties";
  } catch {
    return "/properties";
  }
}
export function propertyDetailHref(
  slug: string,
  returnTo?: string,
  anchor?: string,
) {
  const path = `/properties/${encodeURIComponent(slug)}`;
  const query = returnTo
    ? `?${new URLSearchParams({ returnTo: safePropertiesReturn(returnTo) })}`
    : "";
  return `${path}${query}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`;
}
