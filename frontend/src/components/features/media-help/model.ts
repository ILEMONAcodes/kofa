import source from "./screens.json";
import type {
  StaffBlock,
  StaffScreen,
} from "@/components/features/staff-operations/model";
export type MediaBlock = Omit<StaffBlock, "children"> & {
  disabled?: boolean;
  error?: string | null;
  children?: MediaBlock[];
};
export const mediaScreens = source as (Omit<StaffScreen, "blocks"> & {
  blocks: MediaBlock[];
})[];
export const mediaPath = (slug: string) => `/media-help-preview/${slug}`;
export const policySlugs = [
  "terms",
  "privacy",
  "fees",
  "verification",
  "refunds",
  "reporting",
];
export const fieldOptions: Record<string, string[]> = {
  "Cover photo": ["Living room", "Bedroom", "Exterior"],
  Reason: [
    "Asked to pay outside Kof’a",
    "Fake listing",
    "Wrong price",
    "Misleading description",
    "Already let or sold",
    "Unauthorised agent",
  ],
};
export function destination(
  slug: string,
  label: string,
  context = "",
): string | null {
  if (label === "View details →")
    return (
      (
        {
          "Property checks": "verification",
          "Fees and conditions": "fees",
          "Report a concern": "reporting",
          "Your privacy": "privacy",
          Terms: "terms",
          Privacy: "privacy",
          "Refund conditions": "refunds",
        } as Record<string, string>
      )[context] ?? null
    );
  if (label === "Back") {
    const parents: Record<string, string> = {
      media: "/landlord?step=features&preview=1",
      help: "/",
      gallery: "/properties/3-bedroom-flat-wuse-2",
      "gallery-photo": "gallery",
      walkthrough: "gallery",
      report: "/properties/3-bedroom-flat-wuse-2",
      "report-evidence": "report",
    };
    if (parents[slug]) return parents[slug];
    return [
      "photo-preview",
      "remove-photo",
      "add-video",
      "uploading",
      "upload-complete",
      "upload-failed",
      "unsupported-file",
    ].includes(slug)
      ? "media"
      : "help";
  }
  const links: Record<string, string> = {
    "Back to media": "media",
    "Back to photos": "media",
    "Preview selected photo": "photo-preview",
    "Remove selected photo": "remove-photo",
    "Keep photo": "media",
    "View completed upload": "upload-complete",
    "See retry state": "upload-failed",
    "Unsupported-file example": "unsupported-file",
    "Skip video": "media",
    "Express interest": "/client-preview/inquiry",
    Photos: "gallery",
    "Next photo": "gallery-photo",
    "Previous photo": "gallery",
    "Video walkthrough": "walkthrough",
    "Back to property": "/properties/3-bedroom-flat-wuse-2",
    "Back to listing": "/properties/3-bedroom-flat-wuse-2",
    "Review my listing": "/landlord?step=review&preview=1",
    "Back to features": "/landlord?step=features&preview=1",
    "How reporting works": "reporting",
    "Continue report": "report",
    "Continue complaint": "/client-preview/complaint-form",
    "How do property checks work?": "assistant-answer",
    "Speak to a person": "handoff",
    "Contact a person": "handoff",
    "Back to assistant": "assistant",
    "Report a listing": "report",
    "Help centre": "help",
    "Ask the assistant": "assistant",
    "Source: How property checks work": "verification",
    "Message the team": "/client-preview/general-inquiry",
    "Message our team": "/client-preview/general-inquiry",
    "Speak to our team": "/client-preview/general-inquiry",
    "Speak to the team": "/client-preview/general-inquiry",
    "Back to browsing": "/properties",
    "Back to homes": "/",
    "Browse homes": "/properties",
    "Continue browsing": "/properties",
    "Find another home": "/properties",
    "Explore homes": "/properties",
    "Go to homepage": "/",
    "Clear filters": "/properties",
    "Edit filters": "/properties?filters=open",
    "View loaded results": "/properties",
    "Back to account": "/account",
    "Return to your account": "/account",
    "Log in": "/login",
    "Back to login": "/login",
    "Return to listing form": "/landlord?step=property",
    "Reload property record": "/staff-preview/property",
    "Workspace overview": "/staff-preview/overview",
  };
  return links[label] ?? null;
}
export function outcome(label: string): string | null {
  return (
    (
      {
        "Submit report": "report-received",
        "Retry upload": "uploading",
        "Cancel this upload": "media",
        "Send question": "assistant-answer",
        Helpful: "feedback",
        "Not helpful": "feedback",
        "Try again": "loading",
        "Primary action": "saved",
      } as Record<string, string>
    )[label] ?? null
  );
}
export function flatten(blocks: MediaBlock[]): MediaBlock[] {
  return blocks.flatMap((b) => [b, ...flatten(b.children ?? [])]);
}
