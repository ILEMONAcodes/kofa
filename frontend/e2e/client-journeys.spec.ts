import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const screens: { slug: string; blocks: { text?: string }[] }[] = JSON.parse(
  readFileSync("src/components/features/client-journeys/screens.json", "utf8"),
);
test("all client designs fit mobile width", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const screen of screens) {
    await page.goto(`/client-preview/${screen.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      screen.blocks[1].text!,
    );
    if (screen.slug === "overview") {
      await page.waitForTimeout(1200);
      await page.screenshot({ path: "/tmp/kofa-client-overview.png" });
    }
    expect(
      await page
        .locator(".journey-body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
});
test("inquiry dropdown and explicit preview outcome", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/client-preview/inquiry");
  await page.getByLabel("Request type", { exact: true }).selectOption("Other");
  await page.getByLabel("Specify request type").fill("Discuss viewing");
  await page
    .getByLabel("Tell us what you need")
    .fill("Please arrange a viewing next week.");
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("No request was sent");
  await page.getByRole("link", { name: "Preview example outcome" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your inquiry is with us.",
  );
});

test("client forms have no serious accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/client-preview/complaint-form");
  await page.waitForTimeout(1200);
  const results = await new AxeBuilder({ page })
    .include(".journey-screen")
    .analyze();
  expect(
    results.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});

test("evidence limits reject extra files without uploading", async ({
  page,
}) => {
  await page.goto("/client-preview/complaint-form");
  await page
    .locator("input[type=file]")
    .setInputFiles(
      Array.from({ length: 4 }, (_, i) => ({
        name: `evidence-${i}.pdf`,
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 sample"),
      })),
    );
  await expect(
    page.getByRole("alert").filter({ hasText: "Choose up to three" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Remove evidence/ }),
  ).toHaveCount(0);
});

test("records open the matching client detail screen", async ({ page }) => {
  for (const [list, detail] of [
    ["inspections", "inspection-review"],
    ["transactions", "transaction-detail"],
    ["complaints", "complaint-detail"],
    ["notifications", "notification-detail"],
  ]) {
    await page.goto(`/client-preview/${list}`);
    await page
      .getByRole("button", { name: "Open record →", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/client-preview/${detail}$`));
  }
});
