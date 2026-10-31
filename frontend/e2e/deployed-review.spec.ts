import {reviewLogin} from "./review-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("kofa-launch-seen", "1"),
  );
});
test("naira prefixes clear all budget text and stay centered after validation", async ({
  page,
}) => {
  test.setTimeout(120000);

  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/account/inquiry",
      "/staff/qualification",
      "/responsive-preview/inquiry",
    ]) {
      await reviewLogin(page,route.startsWith("/staff") ? "staff" : "client");
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
