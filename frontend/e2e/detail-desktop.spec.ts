import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
const path = "/properties/3-bedroom-flat-wuse-2";
test("desktop detail matches source geometry, assets and public content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  const ids = [
    "28:826",
    "15:414",
    "15:420",
    "15:425",
    "15:426",
    "15:443",
    "28:850",
  ];
  const bounds = await page.evaluate(
    (ids) =>
      ids.map((id) => {
        const b = document
          .querySelector(`[data-node-id="${id}"]`)!
          .getBoundingClientRect();
        return {
          id,
          x: b.x,
          y: b.y + window.scrollY,
          width: b.width,
          height: b.height,
        };
      }),
    ids,
  );
  await writeFile(
    "test-results/detail-geometry.json",
    JSON.stringify(bounds, null, 2),
  );
  const expected = [
    [0, 0, 1440, 116],
    [0, 116, 1440, 768],
    [120, 390, 1200, 430],
    [0, 884, 1440, 1025],
    [120, 948, 768, 897],
    [936, 948, 384, 469],
    [0, 1909, 1440, 614],
  ];
  for (let i = 0; i < bounds.length; i++)
    for (const [j, key] of ["x", "y", "width", "height"].entries())
      expect(bounds[i][key as "x" | "y" | "width" | "height"]).toBeCloseTo(
        expected[i][j],
        0,
      );
  const assets = page.locator("[data-detail-asset]");
  await expect(assets).toHaveCount(3);
  const sizes = [
      [792, 430],
      [384, 207],
      [384, 207],
    ],
    files = ["home-living-room.jpg", "home-jabi.jpg", "home-architecture.jpg"];
  for (const [index, img] of (await assets.all()).entries()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(await img.getAttribute("src")).toContain(files[index]);
    const b = await img.boundingBox();
    expect(b?.width).toBe(sizes[index][0]);
    expect(b?.height).toBe(sizes[index][1]);
  }
  for (const [selector, width, height] of [
    [".home-header-logo img", 144.5, 46.8333],
    [".home-footer-logo img", 192.667, 62.4445],
  ] as const) {
    const logo = page.locator(selector);
    await logo.scrollIntoViewIfNeeded();
    expect(
      await logo.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    ).toBe(true);
    const size = await logo.boundingBox();
    expect(size?.width).toBeCloseTo(width, 1);
    expect(size?.height).toBeCloseTo(height, 1);
  }
  await expect(
    page.getByText(
      "Verification confirms the checks listed. It is not a guarantee of legal title.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Caution fee: ₦350,000")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/detail-desktop-1440.png",
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
test("gallery, reason dropdown and interest actions work without fake submission", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  await page
    .getByRole("button", { name: "Open photo 2: Living room", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Explore every angle.",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Living room · 2 of 3");
  await dialog.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(dialog).toContainText("Exterior · 3 of 3");
  await dialog
    .getByRole("button", { name: "Video walkthrough", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "No video walkthrough",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open photo 2: Living room",
      exact: true,
    }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Report this listing", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Something doesn’t look right?",
    exact: true,
  });
  await dialog.getByRole("combobox", { name: "Reason", exact: true }).click();
  await dialog.getByRole("option", { name: "Other", exact: true }).click();
  await expect(
    dialog.getByRole("textbox", { name: "Specify your concern" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Submit report" }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Ask Kof’a", exact: true }).click();
  await expect(
    page.getByRole("dialog", {
      name: "A little guidance, when you need it.",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Express interest", exact: true })
    .click();
  await page.waitForURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(path);
});
test("home and search cards resolve correct details and preserve search URL", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".home-property-card")
    .first()
    .getByRole("link", { name: "3-bedroom flat, Wuse 2", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "3-bedroom flat, Wuse 2",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  const search = "/properties?city=Abuja&price_max=500000000&sort=price";
  await page.goto(search);
  await page
    .locator(".search-property-card")
    .first()
    .getByRole("link", { name: "2-bedroom flat, Jabi", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "2-bedroom flat, Jabi",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("₦2,500,000 /year", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Properties", exact: true })
    .click();
  await page.waitForURL(
    (url) =>
      url.pathname === "/properties" &&
      url.searchParams.get("sort") === "price",
  );
  await expect(
    page.getByRole("textbox", { name: "Maximum price", exact: true }),
  ).toHaveValue("5,000,000");
  const response = await page.goto("/properties/does-not-exist");
  expect(response?.status()).toBe(404);
});
test("detail fallback stays accessible without horizontal overflow", async ({
  page,
}) => {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
