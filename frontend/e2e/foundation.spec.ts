import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [360, 768, 1280]) {
  test(`foundation routes and accessibility at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000); // Seven route-level axe scans now include the full mobile browse content.
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/properties",
      "/properties/sample-slug",
      "/landlord",
      "/admin",
      "/login",
      "/account",
    ]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
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
    await page.goto("/properties");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    if (width < 768)
      await page
        .getByRole("button", { name: "Open filters", exact: true })
        .click();
    await expect(
      page.getByRole("combobox", { name: "Location" }),
    ).toBeEnabled();
    if (width < 768) await page.keyboard.press("Escape");
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await page.screenshot({
      path: `test-results/properties-${width}.png`,
      fullPage: true,
    });
  });
}
