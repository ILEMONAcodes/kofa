import { reviewLogin } from "./review-helpers";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("client fees, timelines and entry links are connected", async ({
  page,
}) => {
  await roleNavigate(page, "/account/transaction-detail");
  await page
    .getByRole("link", { name: "Agreement and completion timeline" })
    .click();
  await expect(page).toHaveURL(/verification\/agreement$/);
  await expect(
    page.getByText("Amount: ₦70,000", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Conditions: 2% of annual rent", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fee guidance" }).click();
  await expect(page).toHaveURL(/resources\/fees$/);
  await roleNavigate(page, "/verification/completed");
  await expect(
    page.getByText("20 Oct 2026 · History retained.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "My transactions", exact: true })
    .click();
  await expect(page).toHaveURL(/account\/transactions$/);
});
test("client verification summary Help opens the shared help centre", async ({
  page,
}) => {
  await roleNavigate(page, "/verification/agreement");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page).toHaveURL(/resources\/help$/);
});

test("old verification URLs open the live workspace and retain the selected ID", async ({
  page,
}) => {
  await reviewLogin(page, "staff");
  for (const slug of [
    "checks",
    "checks-saved",
    "owner-approval",
    "publication-ready",
    "publish",
  ]) {
    await page.goto(`/verification/${slug}`);
    await expect(page).toHaveURL(/staff\/property$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Choose a property",
    );
  }
  const id = "00000000-0000-4000-8000-000000000001";
  await page.goto(`/verification/checks?id=${id}`);
  await expect(page).toHaveURL(`http://127.0.0.1:3100/staff/property?id=${id}`);
});
test("client verification summaries remain responsive and accessible", async ({
  page,
}) => {
  await reviewLogin(page, "client");
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const slug of ["agreement", "completed"]) {
      await page.goto(`/verification/${slug}`);
      expect(
        await page
          .locator(".journey-body")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
  }
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});
async function roleNavigate(page: Page, path: string) {
  await reviewLogin(page, "client");
  await page.goto(path);
}
