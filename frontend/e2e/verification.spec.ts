import { reviewLogin } from "./review-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
type Block = {
  id: string;
  type: string;
  text?: string;
  height?: number;
  children?: Block[];
};
const screens: { slug: string; blocks: Block[] }[] = JSON.parse(
  readFileSync(
    new URL(
      "../src/components/features/verification/screens.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const flatten = (blocks: Block[]): Block[] =>
  blocks.flatMap((b) => [b, ...flatten(b.children ?? [])]);
test("all eight verification source screens retain content, assets and geometry", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const s of screens) {
    await roleNavigate(page, `/verification/${s.slug}`);
    await expect(page.locator(".mobile-launch")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      s.blocks[1].text!,
    );
    const body = page.locator(".journey-body");
    const text = await body.innerText();
    for (const b of flatten(s.blocks).filter((b) => b.type === "text"))
      expect(text).toContain(b.text);
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    for (const img of await body.locator("img[data-source-node]").all()) {
      await img.scrollIntoViewIfNeeded();
      expect(
        await img.evaluate(
          (e: HTMLImageElement) => e.complete && e.naturalWidth > 0,
        ),
      ).toBe(true);
      const box = (await img.boundingBox())!;
      expect(box.width).toBe(350);
      expect(box.height).toBe(220);
    }
    const brand = (await page.locator(".staff-brand").boundingBox())!;
    expect(brand.width).toBeCloseTo(101.15, 1);
    expect(brand.height).toBeCloseTo(32.7833, 1);
    expect(brand.y).toBeCloseTo(121.166, 1);
    const icons = page.locator(".journey-nav img");
    await expect(icons).toHaveCount(4);
    for (const icon of await icons.all()) {
      const box = (await icon.boundingBox())!;
      expect(box.width).toBe(22);
      expect(box.height).toBe(22);
      expect(
        await icon.evaluate(
          (e: HTMLImageElement) => e.complete && e.naturalWidth > 0,
        ),
      ).toBe(true);
    }
    await page.locator(".journey-scroll").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: `/tmp/kofa-verification-${s.slug}.png` });
  }
});
test("checks support Other validation and explicit fictional outcomes without mutations", async ({
  page,
}) => {
  let mutations = 0;
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method())) mutations++;
  });
  await roleNavigate(page, "/verification/checks");
  await page.getByLabel("Identity", { exact: true }).selectOption("Other");
  await page
    .getByRole("button", { name: "Save verification", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Action unavailable" }),
  ).not.toBeVisible();
  await page.getByLabel("Specify identity").fill("Sample additional check");
  await page
    .getByRole("button", { name: "Save verification", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your changes have not been saved",
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Get help", exact: true }),
  ).toHaveAttribute("href", "/resources/help");
  await roleNavigate(page, "/verification/checks-saved");
  await expect(page).toHaveURL(/checks-saved$/);
  await page
    .getByRole("button", { name: "Complete verification", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Action unavailable" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Get help", exact: true }),
  ).toHaveAttribute("href", "/resources/help");
  await roleNavigate(page, "/verification/owner-approval");
  await expect(page).toHaveURL(/owner-approval$/);
  expect(mutations).toBe(0);
});
test("owner approval validates notes/date and publication remains disconnected", async ({
  page,
}) => {
  let mutations = 0;
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method())) mutations++;
  });
  await roleNavigate(page, "/verification/owner-approval");
  await expect(page.getByLabel("Approved at (WAT)")).toHaveValue(
    "2026-10-26T09:30",
  );
  await page
    .getByLabel("Approval method", { exact: true })
    .selectOption("Other");
  await page
    .getByLabel("Specify approval method")
    .fill("Sample written permission");
  await page.getByLabel("Evidence / approval note").fill("");
  await page.getByRole("button", { name: "Record current approval" }).click();
  await expect(
    page.getByRole("dialog", { name: "Action unavailable" }),
  ).not.toBeVisible();
  await page
    .getByLabel("Evidence / approval note")
    .fill("Fictional owner confirmed the current example advertisement.");
  await page.getByRole("button", { name: "Record current approval" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Get help", exact: true }),
  ).toHaveAttribute("href", "/resources/help");
  await roleNavigate(page, "/verification/publication-ready");
  await expect(page).toHaveURL(/publication-ready$/);
  await page.getByRole("button", { name: "Review publication" }).click();
  await page
    .getByRole("button", { name: "Publish listing", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Nothing was submitted");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Get help", exact: true }),
  ).toHaveAttribute("href", "/resources/help");
  await roleNavigate(page, "/verification/published");
  await expect(page).toHaveURL(/published$/);
  expect(mutations).toBe(0);
  await page.getByRole("button", { name: "View public listing" }).click();
  await expect(page).toHaveURL(/properties\/3-bedroom-flat-wuse-2$/);
});
test("client fees, timelines and entry links are connected", async ({
  page,
}) => {
  await roleNavigate(page, "/staff/property");
  await page.getByRole("button", { name: "Menu", exact: true }).first().click();
  await page.getByRole("link", { name: "Verification & publication" }).click();
  await expect(page).toHaveURL(/verification\/checks$/);
  await roleNavigate(page, "/account/transaction-detail");
  await page
    .getByRole("link", { name: "Agreement and completion timeline" })
    .click();
  await expect(page).toHaveURL(/verification\/agreement$/);
  await expect(
    page.getByText("Amount: ₦70,000", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Conditions: 2% of annual rent", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fee guidance" }).click();
  await expect(page).toHaveURL(/resources\/fees$/);
  await roleNavigate(page, "/verification/completed");
  await expect(
    page.getByText("20 Oct 2026 · History retained.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "My transactions", exact: true })
    .click();
  await expect(page).toHaveURL(/account\/transactions$/);
});
test("responsive navigation, menus, keyboard and accessibility", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [360, 768, 1280])
    for (const slug of ["checks", "agreement", "completed"]) {
      await page.setViewportSize({ width, height: 844 });
      await roleNavigate(page, `/verification/${slug}`);
      expect(
        await page
          .locator(".journey-body")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
  for (const slug of [
    "checks",
    "owner-approval",
    "publish",
    "agreement",
    "completed",
  ]) {
    await roleNavigate(page, `/verification/${slug}`);
    const violations = (
      await new AxeBuilder({ page }).analyze()
    ).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(violations).toEqual([]);
  }
  await roleNavigate(page, "/verification/checks");
  await page.getByRole("button", { name: "Menu", exact: true }).first().click();
  await expect(page.getByRole("dialog").locator("ol li")).toHaveCount(0);
  await expect(
    page
      .getByRole("dialog")
      .getByRole("navigation", { name: "Useful links" })
      .getByRole("link"),
  ).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }).first(),
  ).toBeFocused();
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Overview" }),
  ).toHaveAttribute("href", "/staff/overview");
  await roleNavigate(page, "/verification/agreement");
  await expect(
    page.getByRole("button", { name: "Help", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Account" }),
  ).toHaveAttribute("href", "/account");
});

test("client verification summary Help opens the shared help centre", async ({
  page,
}) => {
  await roleNavigate(page, "/verification/agreement");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page).toHaveURL(/resources\/help$/);
});

test.beforeEach(async ({ page }) => {
  await reviewLogin(page,"admin");
  await page.addInitScript(() => {
    sessionStorage.setItem("kofa-launch-seen", "1");
  });
});

async function roleNavigate(page: import("@playwright/test").Page, path:string) {
 const client=/^\/(account|review\/feedback|verification\/(agreement|completed)|responsive-preview\/(inquiry|inquiries|conversation))($|[/?])/.test(path);
 await reviewLogin(page,client ? "client" : "admin");
 await page.goto(path);
}
