import source from "./screens.json";
import type { MediaBlock } from "@/components/features/media-help/model";
export const verificationScreens: {
  slug: string;
  id: string;
  blocks: MediaBlock[];
}[] = source;
export const verificationPath = (slug: string) =>
  `/verification-preview/${slug}`;
export const isVerificationWorkspace = (slug: string) =>
  !["agreement", "completed"].includes(slug);
export const verificationOptions: Record<string, string[]> = {
  ...Object.fromEntries(
    [
      "Identity",
      "Ownership / authorisation",
      "Location",
      "Advertised price",
      "Features",
      "Availability",
    ].map((label) => [
      label,
      ["Passed", "Failed", "Not applicable", "Not checked"],
    ]),
  ),
  Method: [
    "Desk review and physical inspection",
    "Desk review",
    "Physical inspection",
  ],
  "Approval method": ["Phone", "WhatsApp", "Email", "In person"],
};
export function verificationDestination(
  slug: string,
  label: string,
): string | null {
  if (label === "Back") return "/client-preview/transactions";
  const links: Record<string, string> = {
    "Back to property": "/staff-preview/property",
    "Edit checks": "checks",
    "Back to verification": "checks",
    "Review publication": "publish",
    "Keep unpublished": "publication-ready",
    "View public listing": "/properties/3-bedroom-flat-wuse-2",
    Properties: "/staff-preview/properties",
    "Ask the team": "/client-preview/general-inquiry",
    "Fee guidance": "/media-help-preview/fees",
    "My transactions": "/client-preview/transactions",
    "Raise a concern": "/client-preview/complaint-form",
  };
  return links[label] ?? null;
}
export function verificationOutcome(label: string): string | null {
  return (
    (
      {
        "Save verification": "checks-saved",
        "Complete verification": "owner-approval",
        "Record current approval": "publication-ready",
        "Publish listing": "published",
      } as Record<string, string>
    )[label] ?? null
  );
}
