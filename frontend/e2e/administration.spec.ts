import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, existsSync } from "node:fs";
type Block = { id: string; type: string; text?: string; children?: Block[] };
const screens: { slug: string; blocks: Block[] }[] = JSON.parse(
  readFileSync("src/components/features/administration/screens.json", "utf8"),
);
for (let start = 0; start < screens.length; start += 10) {
  const group = screens.slice(start, start + 10);
  test(`administration source screens ${start + 1}–${start + group.length}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const screen of group) {
      await page.goto(`/admin/${screen.slug}`);
      await expect(page.locator(".mobile-launch")).toBeHidden();
      if (screen.slug === "users") {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Your team, together.",
        );
        continue;
      }
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        screen.blocks[1].text!,
      );
      const body = page.locator(".journey-body");
      expect(
        await body.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const content = await body.innerText();
      const text = (blocks: Block[]) =>
        blocks.forEach((block) => {
          if (block.type === "text") expect(content).toContain(block.text);
          if (block.children) text(block.children);
        });
      text(screen.blocks);
      const brand = (await page.locator(".staff-brand").boundingBox())!;
      expect(brand.width).toBeCloseTo(101.15, 1);
      expect(brand.height).toBeCloseTo(32.7833, 1);
      expect(brand.y).toBeCloseTo(121.166, 1);
      for (const icon of await page.locator(".journey-nav img").all()) {
        const box = (await icon.boundingBox())!;
        expect(box.width).toBe(22);
        expect(box.height).toBe(22);
      }
      expect(existsSync("public/assets/client-logo.svg")).toBe(true);
      if (
        [
          "transactions",
          "transaction",
          "complaint",
          "administration",
          "users",
          "reports",
          "knowledge",
          "support-settings",
        ].includes(screen.slug)
      )
        await page.screenshot({
          path: `/tmp/kofa-administration-${screen.slug}.png`,
        });
    }
  });
}
test("staff reports and administration menu are connected", async ({
  page,
}) => {
  await page.goto("/staff/overview");
  await page.getByRole("button", { name: "View reports", exact: true }).click();
  await expect(page).toHaveURL(/admin\/reports$/);
  await page.getByRole("button", { name: "Menu", exact: true }).first().click();
  await expect(page.getByRole("dialog").locator("ol li")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Workspace sections" })
    .getByRole("link", { name: "Users", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your team, together.",
  );
  await page
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("staff");
  await expect(
    page.getByRole("button", { name: "Add team member", exact: true }),
  ).toBeVisible();
});
test("transaction fields validate without posting or calculating fees", async ({
  page,
}) => {
  const unsafe: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) unsafe.push(request.url());
  });
  await page.goto("/admin/create-transaction");
  await page
    .getByLabel("Transaction type", { exact: true })
    .selectOption("Other");
  await page
    .getByLabel("Specify transaction type", { exact: true })
    .fill("Discuss terms");
  await page.getByLabel("Agreed price (₦)", { exact: true }).fill("invalid");
  await page
    .getByRole("button", { name: "Create transaction", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "valid amount" }),
  ).toBeVisible();
  await page.getByLabel("Agreed price (₦)", { exact: true }).fill("3,500,000");
  await page
    .getByRole("button", { name: "Create transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Nothing was submitted");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Get help", exact: true }),
  ).toHaveAttribute("href", "/resources/help");
  await page.goto("/admin/transaction");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Transaction TXN-000123.",
  );
  expect(unsafe).toEqual([]);
});
test("complaint review and resolution remain explicit examples", async ({
  page,
}) => {
  await page.goto("/admin/complaint");
  await page
    .getByRole("button", { name: "Review evidence", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Review the evidence privately.",
  );
  await page
    .getByRole("button", { name: "Record investigation", exact: true })
    .click();
  await page.getByLabel("Findings", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Review resolution", exact: true })
    .click();
  await expect(page).toHaveURL(/admin\/investigation$/);
  await page
    .getByLabel("Findings", { exact: true })
    .fill("Fictional review finding for the interface preview.");
  await page
    .getByLabel("Evidence reviewed", { exact: true })
    .fill("Fictional screenshot reference reviewed.");
  await page
    .getByRole("button", { name: "Review resolution", exact: true })
    .click();
  await expect(
    page.getByText("Generic reporter update", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resolve case", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Nothing was submitted");
});
test("invitations and settings do not send email or change configuration", async ({
  page,
}) => {
  const unsafe: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) unsafe.push(request.url());
  });
  await page.goto("/admin/invite-user");
  await page.getByLabel("Email", { exact: true }).fill("invalid");
  await page
    .getByRole("button", { name: "Create staff account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByLabel("Email", { exact: true })
    .fill("example.staff@example.com");
  await page
    .getByRole("button", { name: "Create staff account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Nothing was submitted");
  await page.goto("/admin/support-settings");
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Review settings change", exact: true })
    .click();
  await expect(page.getByText("No live change", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Nothing was submitted");
  expect(unsafe).toEqual([]);
});
test("ledger posting and article publishing have no service mutations", async ({
  page,
}) => {
  const unsafe: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) unsafe.push(request.url());
  });
  for (const [slug, label] of [
    ["confirm-payment", "Post ledger entry"],
    ["publish-article", "Publish article"],
    ["confirm-permanent-action", "Record admin action"],
  ]) {
    await page.goto(`/admin/${slug}`);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Nothing was submitted",
    );
  }
  expect(unsafe).toEqual([]);
});
test("administration forms fit mobile and wider review layouts", async ({
  page,
}) => {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 640 });
    await page.goto("/admin/support-settings");
    expect(
      await page
        .locator(".journey-body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Review settings change", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Review settings change", exact: true }),
    ).toBeVisible();
  }
});
test("representative administration views have no serious accessibility violations", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of [
    "create-transaction",
    "investigation",
    "invite-user",
    "edit-article",
    "support-settings",
  ]) {
    await page.goto(`/admin/${slug}`);
    await expect(page.locator(".mobile-launch")).toBeHidden();
    const results = await new AxeBuilder({ page })
      .include(".staff-preview")
      .analyze();
    expect(
      results.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  }
});

test("payment receipt keeps the date supplied by the source design", async ({
  page,
}) => {
  await page.goto("/admin/record-payment");
  await expect(
    page.getByLabel("Received at (WAT)", { exact: true }),
  ).toHaveValue("2026-10-26T09:00");
  await page
    .getByRole("button", { name: "Review payment entry", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Confirm this ledger entry.",
  );
  await expect(page.locator(".journey-body")).toContainText("26 Oct 2026");
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("kofa-local-access-v1", "admin");
    sessionStorage.setItem("kofa-launch-seen", "1");
  });
});
