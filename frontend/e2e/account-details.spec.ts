import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { reviewLogin } from "./review-helpers";

test("PWA Account opens current client details, separate inquiries and private own identity", async ({ page, browser }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => sessionStorage.setItem("kofa-launch-seen", "1"));
  await page.setViewportSize({ width: 390, height: 844 });
  await reviewLogin(page, "client");
  const me = (await (await page.request.get("/api/v1/auth/me")).json()).data;
  await page.goto("/properties");
  await page.getByRole("navigation", { name: "App navigation" }).getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/overview$/);
  await expect(page.getByRole("heading", { name: "Your Kof’a account.", exact: true })).toBeVisible();
  const details = page.getByRole("region", { name: "Account details", exact: true });
  await expect(details.getByText(me.full_name, { exact: true })).toBeVisible();
  await expect(details.getByText(me.email, { exact: true })).toBeVisible();
  await expect(details.getByText(me.phone, { exact: true })).toBeVisible();
  await expect(page.getByText("Email not verified", { exact: true })).toBeVisible();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `/tmp/kofa-client-account-${width}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "Your inquiries", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/inquiries$/);
  await page.getByRole("navigation", { name: "Account navigation" }).getByRole("link", { name: "Account", exact: true }).click();
  await expect(details.getByText(me.email, { exact: true })).toBeVisible();
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await reviewLogin(other, "client");
  const otherUser = (await (await other.request.get("/api/v1/auth/me")).json()).data;
  await page.goto(`/account/overview?user_id=${otherUser.id}`);
  await expect(details.getByText(me.email, { exact: true })).toBeVisible();
  await expect(page.getByText(otherUser.email, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out of your account", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByText(me.email, { exact: true })).toHaveCount(0);
  await otherContext.close();
});
