import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ viewport: { width: 390, height: 844 } });
async function settle(page: import("@playwright/test").Page) {
  await expect(
    page.getByRole("status", { name: "Opening Kof’a" }),
  ).not.toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
test("mobile launch appears once and manifest carries brand metadata", async ({
  page,
}) => {
  // Freeze only animation and timer progression while inspecting the transient launch screen.
  const start = new Date("2026-10-29T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.route("**/*.css", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body:
        (await response.text()) +
        "\n.mobile-launch,.mobile-launch img{animation:none!important;transition:none!important}",
    });
  });
  await page.goto("/");
  await page.clock.runFor(20);
  await expect(
    page.getByRole("status", { name: "Opening Kof’a" }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Opening Kof’a" })).toHaveCSS(
    "background-color",
    "rgb(100, 59, 41)",
  );
  await expect(page.locator(".mobile-launch img")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/mobile-launch.png" });
  await page.clock.runFor(1300);
  await settle(page);
  await page.clock.resume();
  await page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Explore", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Explore Abuja", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Opening Kof’a" })).toHaveCount(
    0,
  );
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.background_color).toBe("#643B29");
  for (const icon of manifest.icons)
    expect((await page.request.get(icon.src)).ok()).toBe(true);
});
test("mobile screens match source geometry and remain accessible", async ({
  page,
}) => {
  for (const [path, name] of [
    ["/", "home"],
    ["/properties", "search"],
    ["/properties/3-bedroom-flat-wuse-2", "detail"],
  ]) {
    await page.goto(path);
    await settle(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    expect((await page.locator(".mobile-header").boundingBox())?.height).toBe(
      120,
    );
    expect(
      (
        await page
          .getByRole("navigation", { name: "App navigation" })
          .boundingBox()
      )?.y,
    ).toBe(760);
    if (name === "home") {
      const rect = await page.locator(".mobile-discovery-hero").boundingBox();
      expect(rect).toMatchObject({ x: 20, y: 442, width: 350, height: 290 });
    }
    if (name === "search") {
      const rect = await page
        .locator(".mobile-result-cards .mobile-property-card")
        .first()
        .boundingBox();
      expect(rect).toMatchObject({ x: 20, y: 468, width: 350, height: 470 });
    }
    if (name === "detail") {
      expect(await page.locator(".detail-photo-0").boundingBox()).toMatchObject(
        { x: 20, y: 140, width: 350, height: 280 },
      );
      expect(
        await page.locator(".mobile-interest-bar").boundingBox(),
      ).toMatchObject({ y: 650, height: 110 });
      await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();
    }
    await page.screenshot({ path: `test-results/mobile-${name}-390.png` });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
test("mobile filter viewport scrolls and keeps apply reachable", async ({
  page,
}) => {
  await page.goto("/properties");
  await settle(page);
  await page.getByRole("button", { name: "Open filters", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Make it your search",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(await dialog.boundingBox()).toMatchObject({
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  });
  await page.screenshot({ path: "test-results/mobile-filters-390.png" });
  await dialog
    .getByRole("combobox", { name: "Neighbourhood", exact: true })
    .click();
  await dialog.getByRole("option", { name: "Other", exact: true }).click();
  await dialog
    .getByRole("textbox", {
      name: "Specify neighbourhood preference",
      exact: true,
    })
    .fill("near a park");
  await dialog
    .getByRole("button", {
      name: "Increase maximum price by 100,000 naira",
      exact: true,
    })
    .click();
  await dialog.getByRole("combobox", { name: "Bedrooms", exact: true }).click();
  await dialog.getByRole("option", { name: "2 bedrooms", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Show properties", exact: true }),
  ).toBeInViewport();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Show properties", exact: true })
    .click();
  await page.waitForURL(/q=near/);
  expect(new URL(page.url()).searchParams.get("price_max")).toBe("610000000");
  expect(new URL(page.url()).searchParams.get("bedrooms_min")).toBe("2");
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Load more properties", exact: true })
    .click();
  await expect(
    page.locator(".mobile-result-cards .mobile-property-card"),
  ).toHaveCount(6);
});
test("reduced motion and no-JS entry never leave a blocking splash", async ({
  browser,
}) => {
  const reduced = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const p = await reduced.newPage();
  await p.goto("/");
  await settle(p);
  await reduced.close();
  const nojs = await browser.newContext({
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  const n = await nojs.newPage();
  await n.goto("/");
  await expect(n.locator(".mobile-launch")).toBeHidden();
  await expect(
    n.getByRole("heading", { name: "Welcome to Kof’a", exact: true }),
  ).toBeVisible();
  await nojs.close();
});
