import source from "./screens.json";
import type { MediaBlock } from "../media-help/model";
export const responsiveScreens: {
  slug: string;
  id: string;
  blocks: MediaBlock[];
}[] = source;
export const responsivePath = (slug: string) => `/responsive-preview/${slug}`;
export const responsiveOptions: Record<string, string[]> = {
  "Request type": ["Request inspection", "Express interest"],
  "Filter status": ["All inquiries", "Awaiting team reply", "In progress"],
  Status: ["Submitted / In review", "Submitted", "In review", "Published"],
  Area: ["All areas", "Wuse 2", "Jabi", "Gwarinpa"],
  Assignee: ["My queue", "All assignees", "Verification team", "Unassigned"],
  Outcome: ["Inconclusive", "Substantiated", "Unsubstantiated"],
  Actions: ["No action", "Request correction", "Escalate for review"],
  "Cover photo": ["Living room", "Exterior", "Bedroom"],
};
export function responsiveDestination(
  slug: string,
  label: string,
  context: string,
): string | null {
  if (label === "Open record →")
    return slug === "inquiries" ? "conversation" : "/review/staff-review";
  if (label === "View details →")
    return /inquir/i.test(context)
      ? "inquiries"
      : /concern/i.test(context)
        ? "/admin/complaints"
        : "properties";
  return (
    (
      {
        Back: "/resources/help",
        "Back to property": "/properties/3-bedroom-flat-wuse-2",
        "Start a general inquiry": "/account/general-inquiry",
        "Explore properties": "/properties",
        "View inspection": "/account/inspection-review",
        "View reports": "/admin/reports",
        "Open inspection calendar": "/staff/calendar",
        "Review submission": "/review/staff-review",
        "Review stale availability": "/staff/availability",
        "Preview selected photo": "/resources/photo-preview",
        "Remove selected photo": "/resources/remove-photo",
        "Review my listing": "/landlord?step=review&preview=1",
        "Back to features": "/landlord?step=features&preview=1",
      } as Record<string, string>
    )[label] ?? null
  );
}
