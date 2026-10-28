import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile, mkdir } from "node:fs/promises";
import tokens from "../src/design-tokens/home-desktop.json" with { type: "json" };
test.use({ viewport: { width: 1440, height: 1000 } });
test("desktop homepage matches Figma geometry, tokens and asset slots", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("[data-asset-slot]")).toHaveCount(8);
  for (const image of await page.locator("img[data-asset-slot]").all())
    await image.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(() =>
      page
        .locator("img[data-asset-slot]")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/home-desktop-1440.png",
    fullPage: true,
  });
  const sections = [];
  for (const section of tokens.sections) {
    const box = await page
      .locator(`[data-node-id="${section.id}"]`)
      .boundingBox();
    sections.push({ id: section.id, ...box });
  }
  const assets = await page.locator("[data-asset-slot]").evaluateAll((images) =>
    images.map((image) => {
      const box = image.getBoundingClientRect();
      return {
        slot: image.getAttribute("data-asset-slot"),
        source: image.getAttribute("src"),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        loaded: (image as HTMLImageElement).naturalWidth > 0,
      };
    }),
  );
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/home-geometry.json",
    JSON.stringify({ sections, assets }, null, 2),
  );
  for (const expected of tokens.sections) {
    const actual = sections.find((section) => section.id === expected.id)!;
    for (const key of ["x", "y", "width", "height"] as const)
      expect(actual[key], `${expected.id} ${key}`).toBeCloseTo(
        expected[key],
        0,
      );
  }
  for (const asset of tokens.assets) {
    for (const slot of asset.slots) {
      const actual = assets.find((image) => image.slot === slot)!;
      expect(actual.source).toBe(`/assets/${asset.file}`);
      expect(actual.loaded).toBe(true);
      if ("width" in asset) {
        expect(actual.width).toBeCloseTo(asset.width!, 0);
        expect(actual.height).toBeCloseTo(asset.height!, 0);
      }
    }
  }
  const fonts = await page.locator(".home-page").evaluate((element) => ({
    family: getComputedStyle(element).fontFamily,
    variation: getComputedStyle(element).fontVariationSettings,
    body: getComputedStyle(document.body).backgroundColor,
  }));
  expect(fonts.family.toLowerCase()).toContain("dmsans");
  expect(fonts.variation).toContain("14");
  expect(fonts.body).toBe("rgb(247, 243, 238)");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const documentNode = await cdp.send("DOM.getDocument");
  const renderedFonts = [];
  for (const selector of [".home-wordmark", ".home-budget input"]) {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: documentNode.root.nodeId, selector });
    const result = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    renderedFonts.push({ selector, fonts: result.fonts });
    await writeFile("test-results/home-fonts.json", JSON.stringify(renderedFonts, null, 2));
    expect(result.fonts.length).toBeGreaterThan(0);
    expect(result.fonts.every(font => (font.isCustomFont && font.familyName.startsWith("DM Sans")) || (font.familyName === "Arial" && font.glyphCount === 1))).toBe(true);
  }
  await writeFile("test-results/home-fonts.json", JSON.stringify(renderedFonts, null, 2));
  expect(await page.locator(".home-wordmark").evaluate(element => getComputedStyle(element).fontVariationSettings)).toContain("40");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("dropdowns support selection, dismissal and Other preferences", async ({
  page,
}) => {
  await page.goto("/");
  const where = page.getByRole("combobox", { name: "Where" });
  await where.click();
  await expect(where).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(where).toHaveAttribute("aria-expanded", "false");
  await expect(where).toBeFocused();
  await where.click();
  await page.getByRole("option", { name: "Other", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Specify your preference" }),
  ).toBeVisible();
  await expect(where).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("textbox", { name: "Specify your preference" })
    .fill("Ground floor in Jabi");
  const looking = page.getByRole("combobox", { name: "Looking to" });
  await looking.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(looking).toHaveText(/Buy/);
  await where.click();
  await page
    .getByRole("heading", { name: "Find a place that feels like you." })
    .click();
  await expect(where).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Find my home" }).click();
  await expect(page).toHaveURL(/listing_type=sale/);
  expect(new URL(page.url()).searchParams.get("q")).toBe(
    "Ground floor in Jabi",
  );
});
test("budget supports precise typing, safe steps, validation and query handoff", async ({
  page,
}) => {
  await page.goto("/");
  const budget = page.getByRole("textbox", {
    name: "Budget / year",
    exact: true,
  });
  await page
    .getByRole("button", { name: "Increase budget by 100,000 naira" })
    .click();
  await expect(budget).toHaveValue("Up to ₦5,100,000");
  await page
    .getByRole("button", { name: "Decrease budget by 100,000 naira" })
    .click();
  await expect(budget).toHaveValue("Up to ₦5,000,000");
  await budget.fill("12.345");
  await page.getByRole("button", { name: "Find my home" }).click();
  await expect(budget).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL(/\/$/);
  await budget.fill("0");
  await budget.blur();
  await expect(
    page.getByRole("button", { name: "Decrease budget by 100,000 naira" }),
  ).toBeDisabled();
  await budget.fill("1,500,000.50");
  await budget.blur();
  await page.getByRole("button", { name: "Find my home" }).click();
  await expect(page).toHaveURL(/price_max=150000050/);
  expect(new URL(page.url()).searchParams.get("price_max")).toBe("150000050");
});
