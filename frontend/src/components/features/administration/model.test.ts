import { describe, it, expect } from "vitest";
import {
  administrationDestination,
  administrationFields,
  administrationOutcome,
  administrationScreens,
  validateAdministrationMoney,
} from "./model";
import {
  previewDestination,
  staffScreens,
  type StaffBlock,
} from "@/components/features/staff-operations/model";
describe("administration preview navigation", () => {
  it("keeps records and workspace links in the appropriate sections", () => {
    expect(
      administrationDestination("transactions", "Open record →", "TXN-000123"),
    ).toBe("transaction");
    expect(
      administrationDestination("complaints", "Open record →", "CMP-000125"),
    ).toBe("complaint");
    expect(
      administrationDestination(
        "administration",
        "View details →",
        "AI conversation review",
      ),
    ).toBe("assistant-conversations");
    expect(
      administrationDestination("workspace-menu", "Properties", "Actions"),
    ).toBe("/staff/properties");
    expect(previewDestination("overview", "View reports", "Actions")).toBe(
      "/admin/reports",
    );
    expect(
      previewDestination("outcome-recorded", "Create transaction", "Actions"),
    ).toBe("/admin/create-transaction");
  });
  it("keeps actual posting/publication separate from example outcomes", () => {
    expect(
      administrationDestination(
        "confirm-payment",
        "Post ledger entry",
        "Actions",
      ),
    ).toBeNull();
    expect(administrationOutcome("confirm-payment", "Post ledger entry")).toBe(
      "ledger",
    );
    expect(
      administrationDestination(
        "publish-article",
        "Publish article",
        "Actions",
      ),
    ).toBeNull();
    expect(
      administrationOutcome("fee-disclosure", "View calculated example quote"),
    ).toBeUndefined();
  });
  it("has complete, unique source control identities and valid destinations", () => {
    expect(administrationScreens).toHaveLength(50);
    const adminSlugs = new Set(
      administrationScreens.map((screen) => screen.slug),
    );
    const staffSlugs = new Set(staffScreens.map((screen) => screen.slug));
    for (const screen of administrationScreens) {
      const ids: string[] = [];
      const visit = (block: StaffBlock, context: string) => {
        ids.push(block.id);
        if (block.type === "action") {
          const target = administrationDestination(
            screen.slug,
            block.text!,
            context,
          );
          if (target?.startsWith("/staff/"))
            expect(staffSlugs.has(target.split("/").at(-1)!)).toBe(true);
          else if (target) expect(adminSlugs.has(target)).toBe(true);
          const outcome = administrationOutcome(screen.slug, block.text!);
          if (outcome) expect(adminSlugs.has(outcome)).toBe(true);
        }
        block.children?.forEach((child) => visit(child, block.name || context));
      };
      screen.blocks.forEach((block) => visit(block, ""));
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every(Boolean)).toBe(true);
    }
  });
});
describe("money field presentation validation", () => {
  const required: StaffBlock[] = [
    {
      id: "amount",
      type: "field",
      name: "",
      label: "Amount (₦)",
      value: "50,000",
    },
  ];
  it("accepts contract-formatted amounts without computing fees", () => {
    expect(validateAdministrationMoney(required, {})).toBeUndefined();
    expect(
      validateAdministrationMoney(required, { amount: "1,234.56" }),
    ).toBeUndefined();
  });
  it("rejects malformed or missing required amounts", () => {
    expect(validateAdministrationMoney(required, { amount: "" })).toMatch(
      /Enter/,
    );
    expect(validateAdministrationMoney(required, { amount: "-100" })).toMatch(
      /valid amount/,
    );
    expect(validateAdministrationMoney(required, { amount: "1.234" })).toMatch(
      /valid amount/,
    );
  });
  it("allows an optional empty amount", () => {
    expect(
      validateAdministrationMoney(
        [{ ...required[0], label: "Amount (₦), if applicable" }],
        { amount: "" },
      ),
    ).toBeUndefined();
  });
});

it("finds grouped directory filters", () => {
  const users = administrationScreens.find(
    (screen) => screen.slug === "users",
  )!;
  expect(
    administrationFields(users.blocks).map((field) => field.label),
  ).toEqual(["Search users", "Role", "User status"]);
});
