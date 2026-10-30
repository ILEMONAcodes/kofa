import source from "./screens.json";
import type {
  StaffBlock,
  StaffScreen,
} from "@/components/features/staff-operations/model";
import { parseMoneyInput } from "@/lib/formatters/money";

export const administrationScreens: StaffScreen[] = source;
export const administrationPath = (slug: string) =>
  `/administration-preview/${slug}`;
export const administrationLists = [
  "transactions",
  "complaints",
  "users",
  "knowledge",
  "assistant-conversations",
  "audit",
];
export const administrationSections = [
  "administration",
  "workspace-menu",
  "transactions",
  "complaints",
  "users",
  "reports",
  "audit",
  "knowledge",
  "assistant-conversations",
  "support-settings",
];
const links: Record<string, string> = {
  "Record terms / offer": "agreement",
  "Fee disclosure": "fee-disclosure",
  "Payment ledger": "ledger",
  "Complete transaction": "complete-transaction",
  "Cancel transaction": "cancel-transaction",
  "Review fee rules": "fee-rules",
  "Review rule change": "review-fee-rules",
  "Fee rules": "fee-rules",
  "Edit rules": "fee-rules",
  "Back to transactions": "transactions",
  "All transactions": "transactions",
  Transactions: "transactions",
  "View transaction": "transaction",
  Transaction: "transaction",
  "Record payment": "record-payment",
  "Record reversal": "reverse-payment",
  "Review payment entry": "confirm-payment",
  "Edit entry": "record-payment",
  "Keep open": "transaction",
  "Open investigation": "complaint",
  "Review evidence": "complaint-evidence",
  "Record investigation": "investigation",
  "Place precautionary hold": "precautionary-hold",
  "Dismiss case": "dismiss-complaint",
  "Return to case": "complaint",
  "Case queue": "complaints",
  "All cases": "complaints",
  "Continue investigation": "investigation",
  "Review resolution": "resolve-complaint",
  "Edit investigation": "investigation",
  "Admin permanent action": "permanent-action",
  "Review permanent action": "confirm-permanent-action",
  "Return to investigation": "investigation",
  "Keep investigating": "complaint",
  "Reopen case · Admin": "reopen-complaint",
  Administration: "administration",
  Complaints: "complaints",
  Reports: "reports",
  "Back to reports": "reports",
  "All users": "users",
  "View user": "user",
  "Deactivate user": "deactivate-user",
  "Keep active": "user",
  "Create article": "edit-article",
  "Edit draft": "edit-article",
  "Continue editing": "edit-article",
  "Knowledge base": "knowledge",
  "Review publication · Admin": "publish-article",
  "Return to draft": "edit-article",
  "Unpublish · Admin": "unpublish-article",
  "Keep published": "article",
  "Support settings": "support-settings",
  "Edit settings": "support-settings",
  "Review settings change": "review-support-settings",
  Overview: "/staff-preview/overview",
  Properties: "/staff-preview/properties",
  Inquiries: "/staff-preview/inquiries",
  Inspections: "/staff-preview/inspections",
  Landlords: "/staff-preview/landlords",
  Clients: "/staff-preview/clients",
};
const parents: Record<string, string> = {
  "create-transaction": "transactions",
  agreement: "transaction",
  "record-payment": "ledger",
  "reverse-payment": "ledger",
  "precautionary-hold": "complaint",
  "permanent-action": "investigation",
  "confirm-permanent-action": "permanent-action",
  "reopen-complaint": "complaint",
  "invite-user": "users",
  "support-settings": "administration",
};
export function administrationDestination(
  slug: string,
  label: string,
  context: string,
): string | null {
  if (label === "Open record →")
    return (
      (
        {
          transactions: "transaction",
          complaints: "complaint",
          users: "user",
          knowledge: "article",
          "assistant-conversations": "assistant-conversation",
        } as Record<string, string>
      )[slug] ?? null
    );
  if (label === "View details →")
    return (
      (
        {
          "Staff & users": "users",
          "Knowledge base": "knowledge",
          "Support settings": "support-settings",
          Reports: "reports",
          "Fee rules": "fee-rules",
          "Audit history": "audit",
          "Assistant conversations": "assistant-conversations",
          "AI conversation review": "assistant-conversations",
        } as Record<string, string>
      )[context] ?? null
    );
  if (label === "Create transaction")
    return slug === "create-transaction" ? null : "create-transaction";
  if (label === "Create staff account")
    return slug === "invite-user" ? null : "invite-user";
  if (label === "Cancel" || label === "Back")
    return parents[slug] ?? "administration";
  return links[label] ?? null;
}
export function administrationOutcome(
  slug: string,
  label: string,
): string | undefined {
  if (label === "View calculated example quote") return undefined;
  if (label === "Save working record") return "investigation";
  return (
    {
      "create-transaction": "transaction",
      agreement: "transaction",
      "fee-disclosure": "transaction",
      "confirm-payment": "ledger",
      "reverse-payment": "ledger",
      "complete-transaction": "transaction-recorded",
      "cancel-transaction": "transaction-recorded",
      "review-fee-rules": "fee-rules-saved",
      complaint: "complaint-assigned",
      "precautionary-hold": "hold-recorded",
      "resolve-complaint": "complaint-recorded",
      "confirm-permanent-action": "complaint-recorded",
      "dismiss-complaint": "complaint-recorded",
      "reopen-complaint": "complaint",
      "invite-user": "invitation-ready",
      user: "user-updated",
      "deactivate-user": "user-updated",
      reports: "export-ready",
      "edit-article": "draft-saved",
      "publish-article": "article",
      "unpublish-article": "knowledge",
      "assistant-conversation": "assistant-conversation",
      "review-support-settings": "settings-recorded",
    } as Record<string, string>
  )[slug];
}
export const administrationOptions: Record<string, string[]> = {
  "Transaction status": [
    "All transactions",
    "Terms proposed",
    "Terms agreed",
    "Completed",
    "Cancelled",
  ],
  "Source inquiry / inspection": ["INQ-000123 / APT-000123", "INQ-000124"],
  "Transaction type": ["Rent", "Sale"],
  Landlord: ["Sample owner", "Sample manager"],
  "Event type": ["Offer made", "Terms proposed", "Terms agreed", "Note"],
  "Disclosure method": ["In-platform message", "Email", "Phone"],
  "Ledger type": [
    "Service fee receipt",
    "Inspection fee receipt",
    "Refund record",
  ],
  "Payment channel": [
    "Approved company bank channel",
    "Approved company office channel",
  ],
  Payer: ["Client", "Landlord"],
  "Calculation basis": ["Annual rent", "Sale price", "Fixed amount"],
  "Inquiry status": [
    "All inquiries",
    "New",
    "Triage",
    "Investigating",
    "Resolved",
    "Dismissed",
  ],
  "Case stage": ["New", "Triage", "Investigating", "Resolved", "Dismissed"],
  Assignee: [
    "My queue",
    "All assignees",
    "Sample case coordinator",
    "Sample admin",
    "Unassigned",
  ],
  Reason: [
    "All reasons",
    "Asked to pay outside",
    "Fake listing",
    "Listing mismatch",
    "Service concern",
  ],
  Outcome: [
    "Any outcome",
    "Inconclusive",
    "Substantiated",
    "Partially substantiated",
    "Unsubstantiated",
  ],
  Overdue: ["No", "Yes", "All"],
  Actions: [
    "No action",
    "Listing corrected",
    "Landlord warned",
    "Client warned",
    "Refund recorded",
  ],
  Action: [
    "Reject listing / Block landlord",
    "Reject listing",
    "Block landlord",
  ],
  "Supported outcome": ["Substantiated", "Partially substantiated"],
  "Dismissal reason": [
    "Duplicate",
    "Outside scope",
    "Insufficient information",
  ],
  Role: ["All roles", "Staff", "Admin", "Client"],
  "User status": ["Active", "Inactive", "All users"],
  "Date range": ["This month", "This week", "Today", "All dates"],
  Actor: ["All actors", "Sample coordinator", "Sample admin"],
  "Audit action": [
    "All actions",
    "Availability confirmed",
    "Listing unpublished",
    "User updated",
  ],
  "Article status": ["All articles", "Published", "Draft", "Unpublished"],
  Category: [
    "All categories",
    "Verification",
    "Fees",
    "Inspections",
    "General",
  ],
  "Handoff reason": [
    "All reasons",
    "Low confidence",
    "Out of scope",
    "Service unavailable",
  ],
  Flag: ["Review needed", "Reviewed", "All flags"],
  "Assistant enabled": ["Enabled", "Disabled"],
};
export function validateAdministrationMoney(
  blocks: readonly StaffBlock[],
  values: Readonly<Record<string, string>>,
): string | undefined {
  for (const block of blocks) {
    if (
      block.type === "field" &&
      /^(Agreed price|Amount)/.test(block.label ?? "")
    ) {
      const value = values[block.id] ?? block.value ?? "";
      try {
        const amount = parseMoneyInput(value);
        if (amount === null && !/if applicable/.test(block.label ?? ""))
          return `Enter ${block.label?.toLowerCase()}.`;
      } catch {
        return `Enter a valid amount for ${block.label?.toLowerCase()}.`;
      }
    }
    if (block.children) {
      const issue = validateAdministrationMoney(block.children, values);
      if (issue) return issue;
    }
  }
}

export function administrationFields(
  blocks: readonly StaffBlock[],
): StaffBlock[] {
  return blocks.flatMap((block) =>
    block.type === "field"
      ? [block]
      : administrationFields(block.children ?? []),
  );
}
