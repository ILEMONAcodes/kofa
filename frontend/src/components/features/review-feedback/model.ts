import source from "./screens.json";
import type { MediaBlock } from "@/components/features/media-help/model";
import { parseMoneyInput } from "@/lib/formatters/money";
export const reviewScreens: {
  slug: string;
  id: string;
  blocks: MediaBlock[];
}[] = source;
export const reviewPath = (slug: string) => `/review/${slug}`;
export const reviewOptions: Record<string, string[]> = {
  ...Object.fromEntries(
    ["Identity", "Ownership documents", "Location", "Price", "Features"].map(
      (label) => [label, ["Pass", "Fail", "Pending", "Not applicable"]],
    ),
  ),
  Method: [
    "Desk review + physical inspection",
    "Desk review",
    "Physical inspection",
  ],
  Period: ["Per year", "Per month", "One-time"],
  "Approval method": [
    "Recorded phone call / email / signed document",
    "Phone",
    "WhatsApp",
    "Email",
    "In person",
    "Signed document",
  ],
};
export function reviewDestination(slug: string, label: string): string | null {
  const links: Record<string, string> = {
    "Open ownership proof": "/staff/document",
    "Record landlord approval": "landlord-approval",
    "Continue to landlord approval": "landlord-approval",
    "Request changes": "/staff/request-changes",
    "Back to verification": "verification-passed",
    "Back to review": "verification-passed",
    "Back to property review": "staff-review",
    "View public listing": "/properties/3-bedroom-flat-wuse-2",
    Back: "/resources/help",
    "Clear filters": "/properties",
    "Browse properties": "/properties",
    "Try again": "/resources/loading",
    "Try logging in again": "/login",
    "Request verification link": "/auth-preview/verify-email",
    "Request a new reset link": "/forgot-password",
  };
  return links[label] ?? null;
}
export function reviewOutcome(label: string): string | null {
  return (
    (
      {
        "Save verification": "verification-passed",
        "Complete verification": "verification-passed",
        "Save approval record": "publication-review",
        "Publish property": "published",
      } as Record<string, string>
    )[label] ?? null
  );
}
export function approvalPriceError(value: string): string | null {
  try {
    const amount = parseMoneyInput(value.trim().replace(/^₦\s*/, ""));
    return amount === null || amount <= 0
      ? "Enter a valid approved price greater than zero."
      : null;
  } catch {
    return "Enter a valid approved price with at most two decimal places.";
  }
}
