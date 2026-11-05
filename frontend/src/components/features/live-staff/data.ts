"use client";
import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api/client";
import { ensureCsrf } from "@/lib/auth/client";
import type { ApiEnvelope } from "@/types/api";
export function useStaffResource<T>(path: string | null, query = "") {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  const key = `${path}?${query}#${revision}`;
  const [result, setResult] = useState<{
    key: string;
    value: ApiEnvelope<T> | null;
    error: unknown;
  } | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    const controller = new AbortController();
    apiRequest<T>(path, {
      query: Object.fromEntries(new URLSearchParams(query)),
      signal: controller.signal,
    })
      .then((value) => {
        if (active) setResult({ key, value, error: null });
      })
      .catch((error) => {
        if (active) setResult({ key, value: null, error });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, query, key]);
  const current = result?.key === key ? result : null;
  return {
    data: current?.value?.data ?? null,
    meta: (
      current?.value as
        | (ApiEnvelope<T> & { meta?: import("@/types/api").Pagination })
        | null
    )?.meta,
    error: current?.error,
    loading: !!path && !current,
    reload,
  };
}
export async function staffWrite<T>(
  path: string,
  method: string,
  body?: unknown,
) {
  await ensureCsrf();
  return (
    await apiRequest<T>(path, {
      method,
      body,
      timeoutMs: body instanceof FormData ? 120000 : 15000,
    })
  ).data;
}
