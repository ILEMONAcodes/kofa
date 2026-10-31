import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const forbidden =
  /design preview|mock(?:ed)? (?:up|design)|fictional|illustrative|sample content|design screens|prototype|backend integration/i;
test("product screens have customer-facing copy without design annotations", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/properties",
    "/properties/3-bedroom-flat-wuse-2",
    "/register",
    "/landlord",
    "/account/inquiries",
    "/staff/overview",
    "/admin/administration",
    "/resources/help",
    "/verification/checks",
    "/review/staff-review",
    "/responsive-preview/media",
    "/admin",
    "/admin/fee-rules-saved",
    "/admin/settings-recorded",
  ]) {
    await page.goto(route);
    await expect(page.locator(".mobile-launch")).toBeHidden();
    expect(await page.locator("body").innerText()).not.toMatch(forbidden);
  }
});
test("primary browse and record actions use brown with light text while secondary actions stay distinct", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".mobile-launch")).toBeHidden();
  const explore = page.getByRole("link", {
    name: "Explore all properties",
    exact: true,
  });
  await expect(explore).toHaveCSS("background-color", "rgb(100, 59, 41)");
  await expect(explore).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.goto("/account/inquiries");
  const open = page
    .getByRole("button", { name: "Open record →", exact: true })
    .first();
  await expect(open).toHaveCSS("background-color", "rgb(100, 59, 41)");
  await expect(open).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(
    page.getByRole("button", { name: "Back", exact: true }),
  ).toHaveCSS("background-color", "rgb(255, 255, 255)");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `/tmp/kofa-ui-polish-${width}.png`,
      fullPage: width === 1280,
    });
  }
});
test("temporary registration does not send or persist credentials", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("example@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test12");
  await page.getByLabel("Confirm password", { exact: true }).fill("test12");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/account\/overview/);
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...sessionStorage, ...localStorage }),
    ),
  ).not.toMatch(/test12|example@example.com/);
});

test.beforeEach(async ({ page }, testInfo) => {
  if (!testInfo.title.includes("registration"))
    await page.addInitScript(() =>
      sessionStorage.setItem("kofa-local-access-v1", "admin"),
    );
});
