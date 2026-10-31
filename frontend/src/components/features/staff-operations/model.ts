import source from "./screens.json";

export type StaffBlock = {
  id: string;
  name: string;
  type: string;
  text?: string;
  label?: string;
  value?: string;
  size?: number;
  line?: number;
  weight?: number;
  tone?: string;
  gap?: number;
  padding?: number;
  radius?: number;
  row?: boolean;
  border?: boolean;
  variant?: string;
  select?: boolean;
  src?: string;
  chevron?: string | null;
  height?: number;
  children?: StaffBlock[];
};
export type StaffScreen = { slug: string; id: string; blocks: StaffBlock[] };
export const staffScreens: StaffScreen[] = source;
export const staffPath = (slug: string) => `/staff/${slug}`;

// Preview destinations describe design examples, not allowed API transitions.
const links: Record<string, string> = {
  "Edit listing": "edit-property",
  "Review media & evidence": "evidence",
  "Request changes": "request-changes",
  "Assign reviewer": "assign-review",
  "Manage status": "listing-status",
  "Return to review": "property",
  "View property record": "property",
  "Review submission": "property",
  "Review stale availability": "availability",
  "Manage property photos": "media",
  "Open evidence preview": "document",
  "Back to submission": "property",
  "Remove selected media": "remove-media",
  "Keep video": "media",
  "Back to evidence": "evidence",
  "Link expired? Refresh access": "document-expired",
  "Back to record": "property",
  "Record landlord response": "landlord-response",
  "View record": "property",
  "Back to properties": "properties",
  Properties: "properties",
  "Review status change": "unpublish",
  "Keep current status": "listing-status",
  "Back to property": "property",
  "View landlord record": "landlord",
  "Open inquiry": "inquiry",
  "Qualification & internal notes": "qualification",
  "Back to inquiry": "inquiry",
  "Return to inquiry": "inquiry",
  Pipeline: "inquiries",
  "Back to conversation": "inquiry",
  "Return to client": "client",
  Clients: "clients",
  "Calendar view": "calendar",
  "Open inspection calendar": "calendar",
  "View calendar": "calendar",
  "Choose another time": "schedule-inspection",
  "Check conflicting time": "inspection-conflict",
  "Edit appointment": "schedule-inspection",
  "Record outcome": "inspection-outcome",
  "Cancel inspection": "cancel-inspection",
  "Return to inspection": "inspection",
  "Keep appointment": "inspection",
  "Open inspection": "inspection",
  "List view": "inspections",
};
export function previewDestination(
  slug: string,
  label: string,
  context: string,
): string | null {
  if (label === "Create transaction") return "/admin/create-transaction";
  if (label === "View reports") return "/admin/reports";
  if (label === "View details →" && context === "Review concerns")
    return "/admin/complaints";
  if (label === "Open record →") {
    if (slug === "properties" || slug === "landlord") return "property";
    if (slug === "landlords") return "landlord";
    if (slug === "clients") return "client";
    if (slug === "inspections") return "inspection";
    if (slug === "client")
      return context === "Inspection"
        ? "inspection"
        : context === "Transaction"
          ? "/admin/transaction"
          : "inquiry";
    return "inquiry";
  }
  if (label === "View details →")
    return context === "Review submissions"
      ? "properties"
      : context === "Follow up inquiries"
        ? "inquiries"
        : null;
  if (label === "Schedule inspection" && slug !== "schedule-inspection")
    return "schedule-inspection";
  if (label === "Cancel" || label === "Back")
    return [
      "inspection-outcome",
      "cancel-inspection",
      "schedule-inspection",
    ].includes(slug)
      ? "inspection"
      : "property";
  return links[label] ?? null;
}
export function exampleOutcome(
  slug: string,
  label: string,
): string | undefined {
  if (label === "Save assignment/status") return "inquiry-updated";
  const outcomes: Record<string, string> = {
    "edit-property": "changes-saved",
    media: "media",
    "remove-media": "media",
    "request-changes": "changes-requested",
    "landlord-response": "property",
    "assign-review": "property",
    availability: "availability-updated",
    unpublish: "listing-unpublished",
    inquiry: "reply-recorded",
    qualification: "inquiry",
    client: "client-saved",
    "schedule-inspection": "inspection",
    "inspection-outcome": "outcome-recorded",
    "cancel-inspection": "inspections",
    "document-expired": "document",
  };
  return outcomes[slug];
}
export const staffOptions: Record<string, string[]> = {
  "Property type": [
    "Apartment",
    "Detached house",
    "Semi-detached house",
    "Terrace",
    "Duplex",
    "Studio",
  ],
  "Intended use": ["Residential"],
  State: ["FCT"],
  City: ["Abuja"],
  Area: ["All areas", "Wuse 2", "Jabi", "Gwarinpa"],
  Period: ["Per year", "Per month", "One-time"],
  "Payment terms": ["One year upfront", "Two years upfront", "Monthly"],
  Bedrooms: ["Studio", "1", "2", "3", "4", "5", "6+"],
  Bathrooms: ["1", "2", "3", "4", "5", "6+"],
  Furnishing: ["Unfurnished", "Semi-furnished", "Furnished"],
  Availability: ["Available", "Unavailable"],
  "Availability status": ["Available", "Unavailable"],
  Amenities: ["Parking", "Water supply", "Security", "Power supply"],
  "Cover image": ["Photo 1", "Photo 2", "Photo 3"],
  "Response method": ["Email", "Phone", "In person"],
  Reviewer: ["Verification team", "Property coordinator", "Unassigned"],
  Assignee: [
    "My queue",
    "All assignees",
    "Property coordinator",
    "Verification team",
    "Unassigned",
  ],
  Action: ["Unpublish", "Reject", "Archive", "Reopen · Admin"],
  "Inquiry status": [
    "All inquiries",
    "New inquiry",
    "Qualifying",
    "Inspection planning",
    "Closed",
  ],
  "Preferred areas": ["Wuse 2 / Jabi", "Wuse 2", "Jabi", "Gwarinpa"],
  "Date range": ["This week", "Today", "Next week", "All dates"],
  Representative: [
    "All representatives",
    "Property coordinator",
    "Verification team",
  ],
  Property: ["3-bedroom flat · Wuse 2", "2-bedroom flat · Jabi"],
  Client: ["Ada Obi", "Ada Obi"],
  "Kof’a representative": ["Property coordinator", "Verification team"],
  "Landlord / representative": ["Property owner", "Property manager"],
  "Attendance / outcome": [
    "Completed · Client attended",
    "No show · Client absent",
    "Visit did not take place",
  ],
};
export function mediaError(
  files: readonly Pick<File, "type" | "size">[],
  kind: "photo" | "video",
): string | undefined {
  const limit = kind === "photo" ? 10 : 100;
  const allowed =
    kind === "photo"
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["video/mp4", "video/webm"];
  if (files.length > (kind === "photo" ? 20 : 1))
    return kind === "photo"
      ? "Choose no more than 20 photos in total."
      : "Choose one video.";
  if (files.some((file) => !allowed.includes(file.type)))
    return kind === "photo"
      ? "Choose JPEG, PNG or WebP photos."
      : "Choose an MP4 or WebM video.";
  if (files.some((file) => file.size > limit * 1024 * 1024))
    return `Each ${kind} must be no larger than ${limit} MB.`;
}

export function visibleRecordText(block: StaffBlock): string {
  return [
    block.text ?? "",
    ...(block.children ?? []).map(visibleRecordText),
  ].join(" ");
}
