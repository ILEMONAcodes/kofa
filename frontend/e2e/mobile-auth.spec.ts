import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const screens = [
  "login",
  "register",
  "verify-email",
  "verified",
  "forgot-password",
  "reset-link-sent",
  "reset-password",
  "password-updated",
  "account",
];
test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("kofa-launch-seen", "1"),
  );
});
test("all nine source screens have correct geometry, assets and accessibility", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const screen of screens) {
    await page.goto(`/auth-preview/${screen}`);
    await expect(page.locator(".auth-form h1")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.locator(".auth-form h1").boundingBox();
    expect(geometry?.x).toBe(20);
    expect(geometry?.y).toBe(128);
    expect(geometry?.width).toBe(350);
    if (screen === "login" || screen === "register") {
      const firstInput = await page
        .locator(".auth-form input")
        .first()
        .boundingBox();
      expect(firstInput?.y).toBe(286);
      expect(firstInput?.height).toBe(48);
    }
    if (screen !== "account") {
      expect((await page.locator(".auth-actions").boundingBox())?.y).toBe(690);
    } else {
      await expect(
        page.getByRole("navigation", { name: "App navigation" }),
      ).toBeVisible();
    }
    for (const img of await page.locator(".auth-header img").all()) {
      expect(
        await img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      ).toBeTruthy();
    }
    await expect(page.locator(".auth-header img").nth(0)).toHaveJSProperty(
      "width",
      22,
    );
    await expect(page.locator(".auth-header img").nth(1)).toHaveJSProperty(
      "width",
      104,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/auth-${screen}-390.png` });
  }
});
test("registration validates confirmation without sending credentials", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("sample@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test12");
  await page.getByLabel("Confirm password", { exact: true }).fill("test13");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  expect(
    await page
      .getByLabel("Confirm password", { exact: true })
      .evaluate((el: HTMLInputElement) => el.validationMessage),
  ).toBe("Passwords must match.");
  await page.getByLabel("Confirm password", { exact: true }).fill("test12");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/account\/overview/);
  expect(posts).toEqual([]);
});
test("login and recovery preserve safe return paths and account stays signed out", async ({
  page,
}) => {
  await page.goto("/login?returnTo=%2Fproperties%3Fcity%3DAbuja");
  await page
    .getByRole("link", { name: "Forgot password?", exact: true })
    .click();
  await expect(page).toHaveURL(
    /forgot-password\?returnTo=%2Fproperties%3Fcity%3DAbuja/,
  );
  await page.getByLabel("Email", { exact: true }).fill("sample@example.com");
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Unable to continue");
  await page.goto("/account");
  await expect(page).toHaveURL(/login\?returnTo=/);
  await expect(page.getByText("Ada Obi", { exact: true })).toHaveCount(0);
  await page.goto("/login?returnTo=https%3A%2F%2Fevil.example");
  await expect(
    page.getByRole("link", { name: "Back to browsing", exact: true }),
  ).toHaveAttribute("href", "/properties");
});
test("auth content remains reachable at narrow, short and wider viewports", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 390, height: 500 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/register");
    await page
      .getByRole("link", { name: "Want to list a property? Start here" })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("link", { name: "Want to list a property? Start here" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
