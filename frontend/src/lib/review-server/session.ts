import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isReviewAccessEnabled } from "@/lib/review-access";
import type { ReviewRole } from "@/lib/review-routing";
import { REVIEW_COOKIE, reviewConfig, verifyReviewSession } from "./core";

export function currentReviewConfig() {
  if (!isReviewAccessEnabled(process.env.NEXT_PUBLIC_LOCAL_ACCESS)) return null;
  return reviewConfig(process.env.REVIEW_SESSION_SECRET, process.env.REVIEW_ACCOUNTS_JSON);
}

export async function currentReviewRole() {
  return verifyReviewSession(currentReviewConfig(), (await cookies()).get(REVIEW_COOKIE)?.value);
}

export async function requireReviewRole(allowed: readonly ReviewRole[], returnTo: string) {
  const role = await currentReviewRole();
  if (!role) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (!allowed.includes(role)) notFound();
  return role;
}
