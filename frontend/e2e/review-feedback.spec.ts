import { reviewLogin } from "./review-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const screens: { slug: string }[] = JSON.parse(
  readFileSync(
    new URL("../src/components/features/review-feedback/screens.json", import.meta.url),
    "utf8",
  ),
);
test("staff review references resolve to live records rather than sample results", async ({
  page,
}) => {
  await reviewLogin(page, "staff");
  for (const screen of screens.filter((s) => s.slug !== "feedback")) {
    await page.goto(`/review/${screen.slug}`);
    await expect(page).toHaveURL(/staff\/property$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Choose a property",
    );
  }
});
test("client feedback remains accessible at mobile and desktop widths", async ({
  page,
}) => {
  await reviewLogin(page, "client");
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/review/feedback");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page
        .locator(".journey-body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});
