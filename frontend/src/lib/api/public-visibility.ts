// A narrow pre-render check: never forwards identity or caches publication state.
export async function propertyVisibility(slug: string): Promise<number> {
  try {
    const origin = (process.env.API_ORIGIN ?? "http://127.0.0.1:8000").replace(
      /\/$/,
      "",
    );
    const response = await fetch(
      `${origin}/api/v1/properties/${encodeURIComponent(slug)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    await response.body?.cancel();
    return response.status;
  } catch {
    return 503;
  }
}
