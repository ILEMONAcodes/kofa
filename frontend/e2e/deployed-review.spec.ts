import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("kofa-launch-seen", "1"),
  );
});
test("a hosted-equivalent build signs in and exposes staff/admin inside the PWA", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Staff & admin", exact: true })
    .click();
  await expect(page).toHaveURL(/staff\/login$/);
  await page.getByLabel("Workspace role").selectOption("admin");
  await page.getByLabel("Email", { exact: true }).fill("team@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test12");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/admin\/administration$/);
  await page.goto("/admin/users");
  await expect(
    page.getByRole("button", { name: "Add team member", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/login");
  await expect(
    page.getByRole("link", { name: "Staff & admin", exact: true }),
  ).toHaveAttribute("href", "/staff/login");
  await page.getByLabel("Email", { exact: true }).fill("client@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test12");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/account\/overview$/);
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Staff & admin", exact: true }),
  ).toHaveAttribute("href", "/staff/login");
  expect(posts).toEqual([]);
});
test("naira prefixes clear all budget text and stay centered after validation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() =>
    sessionStorage.setItem("kofa-local-access-v1", "admin"),
  );
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/account/inquiry",
      "/staff/qualification",
      "/responsive-preview/inquiry",
    ]) {
      await page.goto(route);
      const fields = page.locator(".search-budget .input-prefix-control");
      expect(await fields.count()).toBeGreaterThan(0);
      const assertSpacing = async () => {
        for (const field of await fields.all()) {
          const bounds = await field.evaluate((el) => {
            const input = el.querySelector("input")!;
            const symbol = el.querySelector(".input-prefix-symbol")!;
            const ib = input.getBoundingClientRect(),
              sb = symbol.getBoundingClientRect();
            return {
              textStart:
                ib.left + parseFloat(getComputedStyle(input).paddingLeft),
              symbolEnd: sb.right,
              inputCenter: ib.top + ib.height / 2,
              symbolCenter: sb.top + sb.height / 2,
            };
          });
          expect(bounds.textStart - bounds.symbolEnd).toBeGreaterThanOrEqual(8);
          expect(bounds.symbolCenter).toBeCloseTo(bounds.inputCenter, 0);
        }
      };
      await assertSpacing();
      const first = fields.first().locator("input");
      await first.fill("invalid");
      await expect(
        page.getByText("Enter a valid amount with up to two decimal places.", {
          exact: true,
        }),
      ).toBeVisible();
      await assertSpacing();
      await first.fill("3,000,000");
      if (width === 390 && route === "/account/inquiry")
        await page.screenshot({ path: "/tmp/kofa-budget-prefix-fixed.png" });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
test("review login remains accessible on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/login");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
