import { testAccount, reviewLogin } from "./review-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes("mobile entrance")) return;
  await page.addInitScript(() =>
    sessionStorage.setItem("kofa-launch-seen", "1"),
  );
});
async function signIn(
  page: import("@playwright/test").Page,
  staff = false,
  role = "staff",
) {
  await page.goto(staff ? "/staff/login" : "/login");
  const account = await testAccount(page,staff ? role as "staff"|"admin" : "client");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}
test("whole cards navigate from photos and preserve search context on desktop and mobile", async ({
  page,
}) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/properties?city=Abuja&area=jabi");
    const card = page
      .locator(
        width < 768
          ? ".mobile-result-cards .mobile-property-card"
          : ".search-property-card",
      )
      .first();
    const link = card.locator(".property-card-link");
    const href = await link.getAttribute("href");
    await card.click({ position: { x: 120, y: 140 } });
    await expect(page).toHaveURL(
      new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"),
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/");
    const homeCard = page
      .locator(
        width < 768
          ? ".mobile-card-carousel .mobile-property-card"
          : ".home-property-card",
      )
      .first();
    await homeCard.click({ position: { x: 120, y: 140 } });
    await expect(page).toHaveURL(/\/properties\/[^/?]+$/);
  }
});
test("eight-character database sign-in preserves selected property without browser credential storage", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST") posts.push(req.url());
  });
  const account=await testAccount(page,"client");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/properties/3-bedroom-flat-wuse-2");
  await page
    .getByRole("link", { name: "Express interest", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(
    /\/account\/inquiry\?property=3-bedroom-flat-wuse-2/,
  );
  await expect(
    page.getByRole("heading", { name: "3-bedroom flat, Wuse 2", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Request type", { exact: true })).toBeVisible();
  expect(posts).toEqual(["http://127.0.0.1:3100/api/v1/auth/login"]);
  const stored = await page.evaluate(() => ({
    ...sessionStorage,
    ...localStorage,
  }));
  expect(JSON.stringify(stored)).not.toContain("test12");
  expect(JSON.stringify(stored)).not.toContain("example@example.com");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account/inquiries");
  await expect(page).toHaveURL(/\/login\?/);
});
test("public navigation has no staff entrance and admin sees configured team accounts", async ({page})=>{
 await page.goto("/");
 await expect(page.getByRole("link",{name:"Staff sign in",exact:true})).toHaveCount(0);
 await signIn(page,true,"admin"); await expect(page).toHaveURL(/admin\/administration$/);
 await page.goto("/admin/users"); await expect(page.getByRole("heading",{name:"Your team, together.",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Add team member"})).toBeVisible();
 await page.getByRole("link",{name:"Open staff operations"}).click(); await expect(page).toHaveURL(/staff\/overview$/);
});
test("staff cannot open administrator tools and clients cannot open the workspace", async ({
  page,
}) => {
  await signIn(page, true);
  await expect(page).toHaveURL(/\/staff\/overview$/);
  await page.goto("/admin/users");
  await expect(
    page.getByRole("heading", { name: "This doorway leads elsewhere." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await signIn(page);
  await expect(page).toHaveURL(/\/account\/overview$/);
  await page.goto("/staff/overview");
  await expect(
    page.getByRole("heading", { name: "This doorway leads elsewhere." }),
  ).toBeVisible();
});
test("account, staff login and team management fit supported widths and have accessible controls", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, true, "admin");
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/account/overview", "/staff/login", "/admin/users"]) {
      await reviewLogin(page, route.startsWith("/account") ? "client" : "admin");
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await expect(
        page.getByText(/next design|preview next|design screens/i),
      ).toHaveCount(0);
      await page.screenshot({
        path: `/tmp/kofa-connected-${route.slice(1).replaceAll("/", "-")}-${width}.png`,
      });
    }
  }
});
test("mobile entrance holds for three seconds and loading uses the logo orbit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const start = new Date("2026-10-31T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.goto("/");
  // CSS fallback animations use wall time; freeze only the entrance while checking its JS timeline.
  await page.addStyleTag({
    content:
      ".mobile-launch,.mobile-launch img{animation:none!important;transition:none!important}",
  });
  await page.clock.runFor(20);
  await expect(page.locator(".mobile-launch")).toBeVisible();
  await page.clock.runFor(2800);
  await expect(page.locator(".mobile-launch")).toBeVisible();
  await page.clock.runFor(600);
  await expect(page.locator(".mobile-launch")).toHaveCount(0);
  await page.goto("/resources/loading");
  await page.clock.runFor(20);
  await expect(
    page.getByRole("status", { name: "Loading Kof’a", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".brand-loading-orbit")).toHaveCSS(
    "animation-name",
    "brand-orbit",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".brand-loading-orbit")).toHaveCSS(
    "animation-name",
    "none",
  );
});

test("a signed-out saved inquiry link preserves its property through login", async ({
  page,
}) => {
  const account=await testAccount(page,"client");
  await page.goto("/account/inquiry?property=2-bedroom-flat-jabi");
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(
    "/account/inquiry?property=2-bedroom-flat-jabi",
  );
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "2-bedroom flat, Jabi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to property", exact: true }),
  ).toHaveAttribute("href", "/properties/2-bedroom-flat-jabi");
  await page.goto("/staff-preview/overview");
  await expect(page).toHaveURL(/\/staff\/overview$/);
  await expect(
    page.getByRole("heading", { name: "This doorway leads elsewhere." }),
  ).toBeVisible();
});
