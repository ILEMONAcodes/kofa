import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
test("desktop search matches source geometry, assets and accessibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/properties");
  await page.evaluate(() => document.fonts.ready);
  const bounds = await page
    .locator('[data-node-id="14:220"]')
    .evaluate((root) => {
      const ids = [
        "28:781",
        "15:176",
        "15:180",
        "15:181",
        "15:281",
        "28:805",
        "28:806",
      ];
      return ids.map((id) => {
        const b = root
          .querySelector(`[data-node-id="${id}"]`)!
          .getBoundingClientRect();
        return {
          id,
          x: b.x,
          y: b.y + window.scrollY,
          width: b.width,
          height: b.height,
        };
      });
    });
  await writeFile(
    "test-results/search-geometry.json",
    JSON.stringify(bounds, null, 2),
  );
  const expected = [
    [0, 0, 1440, 116],
    [0, 116, 1440, 270],
    [0, 386, 1440, 3292],
    [120, 450, 280, 1276],
    [432, 450, 888, 3164],
    [0, 3678, 1440, 614],
    [32, 3710, 1376, 550],
  ];
  for (let i = 0; i < bounds.length; i++)
    for (const [j, key] of ["x", "y", "width", "height"].entries())
      expect(bounds[i][key as "x" | "y" | "width" | "height"]).toBeCloseTo(
        expected[i][j],
        0,
      );
  const cards = page.locator(".search-property-card");
  await expect(cards).toHaveCount(12);
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        card
          .locator("img")
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
    const b = await card.boundingBox();
    expect(b?.width).toBe(432);
    expect(b?.height).toBe(478);
  }
  for (const name of ["Location", "Neighbourhood"])
    await expect(
      page.getByRole("combobox", { name, exact: true }).locator("img"),
    ).toHaveAttribute("src", "/assets/search-chevron.svg");
  await expect(page.getByRole("combobox", { name: /bathroom/i })).toHaveCount(
    0,
  );
  await expect(
    page
      .locator(".search-property-card")
      .first()
      .getByText("3 bed · 3 bath · Unfurnished", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/search-desktop-1440.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("filters support Other, multi-selection, money validation, URL reload and clear", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/properties");
  await page
    .getByRole("combobox", { name: "Neighbourhood", exact: true })
    .click();
  await page.getByRole("option", { name: "Other", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Specify neighbourhood preference" })
    .fill("near a park");
  await page.getByRole("combobox", { name: "Bedrooms", exact: true }).click();
  await page.getByRole("option", { name: "2 bedrooms", exact: true }).click();
  await page.getByRole("combobox", { name: "Amenities", exact: true }).click();
  await page.getByRole("option", { name: /Parking/ }).click();
  await page.getByRole("option", { name: /Generator/ }).click();
  await page
    .getByRole("button", { name: "Apply choices", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Increase minimum price by 100,000 naira" })
    .click();
  await page
    .getByRole("textbox", { name: "Minimum price", exact: true })
    .fill("7,000,000");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.locator(".search-sidebar [role=alert]")).toContainText(
    "Minimum price",
  );
  await page
    .getByRole("textbox", { name: "Minimum price", exact: true })
    .fill("1,100,000");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await page.waitForURL(/q=near/);
  const url = new URL(page.url());
  expect(url.searchParams.get("price_min")).toBe("110000000");
  expect(url.searchParams.get("bedrooms_max")).toBe("2");
  expect(url.searchParams.get("amenities")).toBe("parking,generator");
  expect(url.searchParams.get("q")).toBe("near a park");
  expect(url.searchParams.has("area")).toBe(false);
  await expect(page.getByRole("status")).toContainText(
    "Filtered search is currently unavailable",
  );
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Bedrooms", exact: true }),
  ).toContainText("2 bedrooms");
  await expect(
    page.getByRole("textbox", { name: "Text-search preference" }),
  ).toHaveValue("near a park");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.waitForURL("**/properties");
  await expect(
    page.getByRole("textbox", { name: "Minimum price", exact: true }),
  ).toHaveValue("1,000,000");
  await expect(
    page.getByRole("combobox", { name: "Amenities", exact: true }),
  ).toContainText("All amenities");
  await page.goBack();
  await expect(
    page.getByRole("combobox", { name: "Bedrooms", exact: true }),
  ).toContainText("2 bedrooms");
});
test("homepage preferences hydrate search and sample sorting changes order", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Find my home ↗" }).click();
  await page.waitForURL(/properties\?/);
  await expect(
    page.getByRole("textbox", { name: "Maximum price", exact: true }),
  ).toHaveValue("5,000,000");
  await expect(
    page.getByRole("textbox", { name: "Minimum price", exact: true }),
  ).toHaveValue("");
  await page.getByRole("combobox", { name: "Sort by", exact: true }).click();
  await page
    .getByRole("option", { name: "Price: low to high", exact: true })
    .click();
  await page.waitForURL(/sort=price/);
  await expect(page.locator(".search-property-card").first()).toContainText(
    "Self-contained room, Garki",
  );
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
});
