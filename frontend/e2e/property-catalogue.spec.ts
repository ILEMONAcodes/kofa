import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
// Audit the checked-in sample slugs without importing Next/server component modules.
const text = readFileSync(
  new URL("../src/components/browse/home-content.ts", import.meta.url),
  "utf8",
);
const slugs = [...text.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]);
async function ready(page: import("@playwright/test").Page) {
  await expect(page.locator(".mobile-launch")).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
}
async function readableCards(
  page: import("@playwright/test").Page,
  selector: string,
) {
  for (const card of await page.locator(selector).all()) {
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("img").first()).toBeVisible();
    await expect
      .poll(() =>
        card
          .locator("img")
          .first()
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
    const rect = (await card.boundingBox())!;
    const copy = card.locator(".home-card-copy");
    await expect(copy).toHaveCSS("color", "rgb(255, 255, 255)");
    for (const child of await copy.locator("h2,h3,p,a").all()) {
      await expect(child).toHaveCSS("color", "rgb(255, 255, 255)");
      const box = (await child.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(rect.x);
      expect(box.x + box.width).toBeLessThanOrEqual(rect.x + rect.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(rect.y);
      expect(box.y + box.height).toBeLessThanOrEqual(rect.y + rect.height);
      // Conservative contrast: source gradient composited over a pure-white image.
      const y = (box.y - rect.y) / rect.height;
      const stops = [
        [0, 0.06],
        [0.48, 0.1],
        [0.62, 0.8],
        [1, 0.97],
      ];
      const high = stops.findIndex((s) => s[0] >= y);
      const a = stops[Math.max(0, high - 1)],
        b = stops[high < 0 ? 3 : high];
      const alpha = a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0] || 1);
      const channels = [20, 10, 5]
        .map((c) => (c * alpha + 255 * (1 - alpha)) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      const lum =
        0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      expect(1.05 / (lum + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  }
}
test("home and Explore captions stay readable at mobile, tablet and desktop sizes", async ({
  page,
}) => {
  test.setTimeout(180000);
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await ready(page);
    const selector =
      width < 768
        ? ".mobile-card-carousel .mobile-property-card"
        : ".home-property-card";
    await expect(page.locator(selector)).toHaveCount(width < 768 ? 12 : 3);
    await readableCards(page, selector);
    await page.locator(selector).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/kofa-readable-home-${width}.png` });
    await page.goto("/properties");
    await ready(page);
    if (width < 768)
      await page
        .getByRole("button", { name: "Load more properties", exact: true })
        .click();
    const results =
      width < 768
        ? ".mobile-result-cards .mobile-property-card"
        : ".search-property-card";
    await expect(page.locator(results)).toHaveCount(12);
    const titles = await page
      .locator(`${results} h2,${results} h3`)
      .allTextContents();
    expect(new Set(titles).size).toBe(12);
    await readableCards(page, results);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    if (width === 390 || width === 1280)
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
    await page.locator(results).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/kofa-readable-explore-${width}.png` });
  }
});
test("twelve distinct detail routes load their own photos and correct price periods", async ({
  page,
}) => {
  test.setTimeout(90000);
  expect(slugs).toHaveLength(12);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of slugs) {
    const response = await page.goto(`/properties/${slug}`);
    expect(response?.status()).toBe(200);
    await ready(page);
    await expect(page.locator("#property-title")).toBeVisible();
    const img = page.locator(".detail-photo-0 img");
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
    const sale = /katampe|kubwa|guzape/.test(slug);
    await expect(page.locator(".mobile-interest-bar")).toContainText(
      sale ? "For sale" : "per year",
    );
    if (sale)
      await expect(page.locator(".mobile-interest-bar")).not.toContainText(
        "per year",
      );
  }
});
test("mobile load more appends distinct results, and sorting spans the whole catalogue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/properties");
  await ready(page);
  await expect(
    page.locator(".mobile-result-cards .mobile-property-card"),
  ).toHaveCount(6);
  await page
    .getByRole("button", { name: "Load more properties", exact: true })
    .click();
  await expect(
    page.locator(".mobile-result-cards .mobile-property-card"),
  ).toHaveCount(12);
  await expect(
    page.getByRole("button", { name: "Load more properties", exact: true }),
  ).toHaveCount(0);
  await page.goto("/properties?sort=price");
  await ready(page);
  await expect(
    page.locator(".mobile-result-cards .mobile-property-card").first(),
  ).toContainText("Self-contained room, Garki");
  await page.goto("/properties?sort=-price");
  await ready(page);
  await expect(
    page.locator(".mobile-result-cards .mobile-property-card").first(),
  ).toContainText("6-bedroom duplex, Guzape");
});
