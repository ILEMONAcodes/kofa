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
      "../src/components/features/review-feedback/screens.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const flatten = (blocks: Block[]): Block[] =>
  blocks.flatMap((b) => [b, ...flatten(b.children ?? [])]);
test("all six source screens preserve content, exact assets and navigation", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const screen of screens) {
    await roleNavigate(page, `/review/${screen.slug}`);
    await expect(page.locator(".mobile-launch")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      screen.blocks[1].text!,
    );
    const body = page.locator(".journey-body");
    const content = await body.innerText();
    for (const b of flatten(screen.blocks).filter((b) => b.type === "text"))
      expect(content).toContain(b.text);
    expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    for (const image of await body.locator("img[data-source-node]").all()) {
      await image.scrollIntoViewIfNeeded();
      expect(
        await image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      ).toBe(true);
      const box = (await image.boundingBox())!;
      expect(box.width).toBe(350);
      expect(box.height).toBe(220);
    }
    const brand = (await page.locator(".staff-brand").boundingBox())!;
    expect(brand.width).toBeCloseTo(101.15, 1);
    expect(brand.height).toBeCloseTo(32.7833, 1);
    const icons = page.locator(".journey-nav img");
    await expect(icons).toHaveCount(4);
    for (const icon of await icons.all()) {
      const box = (await icon.boundingBox())!;
      expect(box.width).toBe(22);
      expect(box.height).toBe(22);
      expect(
        await icon.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      ).toBe(true);
    }
    if (screen.slug === "feedback") {
      await expect(
        page.getByRole("button", { name: "Back", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Help", exact: true }),
      ).toHaveCount(0);
    } else
      await expect(
        page.getByRole("button", { name: "Menu", exact: true }).first(),
      ).toBeVisible();
    await page.locator(".journey-scroll").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: `/tmp/kofa-review-${screen.slug}.png` });
  }
});
test("review checks and sample outcomes remain separate from real operations", async ({
  page,
}) => {
  let mutations = 0;
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method())) mutations++;
  });
  await roleNavigate(page, "/review/staff-review");
  await expect(page.getByLabel("Features", { exact: true })).toHaveValue(
    "Pending",
  );
  await page.getByLabel("Features", { exact: true }).selectOption("Other");
  await page
    .getByLabel("Scope summary")
    .fill("Fictional sample checks and evidence summary.");
  await page
    .getByRole("button", { name: "Save verification", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Action unavailable" }),
  ).not.toBeVisible();
  await page.getByLabel("Specify features").fill("Additional sample feature");
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
  await roleNavigate(page, "/review/verification-passed");
  await expect(page).toHaveURL(/verification-passed$/);
  await expect(page.getByLabel("Features", { exact: true })).toHaveValue(
    "Pass",
  );
  await page
    .getByRole("button", { name: "Continue to landlord approval" })
    .click();
  await expect(page).toHaveURL(/landlord-approval$/);
  expect(mutations).toBe(0);
});
test("landlord approval validates price, Other and description checkbox before example publication", async ({
  page,
}) => {
  let mutations = 0;
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method())) mutations++;
  });
  await roleNavigate(page, "/review/landlord-approval");
  await expect(page.getByLabel("Approved at", { exact: true })).toHaveValue(
    "2026-10-26T10:30",
  );
  const combo = page.getByRole("combobox", {
    name: "Approval method",
    exact: true,
  });
  expect((await combo.boundingBox())!.height).toBe(72);
  await combo.click();
  await page
    .getByRole("listbox", { name: "Approval method", exact: true })
    .getByRole("option", { name: "Other", exact: true })
    .click();
  await page
    .getByLabel("Specify approval method")
    .fill("Sample written permission");
  await page
    .getByLabel("Record note")
    .fill("A fictional approval note references the current advertisement.");
  await page.getByRole("button", { name: "Save approval record" }).click();
  await expect(
    page.getByRole("dialog", { name: "Action unavailable" }),
  ).not.toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "The current advertised description was approved.",
    })
    .check();
  await page.getByLabel("Approved price", { exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Save approval record" }).click();
  await expect(page.locator(".journey-body").getByRole("alert")).toContainText(
    "Enter a valid approved price",
  );
  await page.getByLabel("Approved price", { exact: true }).fill("₦3,500,000");
  await page.getByRole("button", { name: "Save approval record" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Get help", exact: true }),
  ).toHaveAttribute("href", "/resources/help");
  await roleNavigate(page, "/review/publication-review");
  await expect(page).toHaveURL(/publication-review$/);
  await page
    .getByRole("button", { name: "Publish property", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Nothing was submitted");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Get help", exact: true }),
  ).toHaveAttribute("href", "/resources/help");
  await roleNavigate(page, "/review/published");
  await expect(page).toHaveURL(/\/published$/);
  expect(mutations).toBe(0);
  await page.getByRole("button", { name: "View public listing" }).click();
  await expect(page).toHaveURL(/properties\/3-bedroom-flat-wuse-2$/);
});
test("recovery, documents and existing workspace entries are linked", async ({
  page,
}) => {
  for (const [label, target] of [
    ["Clear filters", "/properties"],
    ["Try again", "/resources/loading"],
    ["Browse properties", "/properties"],
    ["Try logging in again", "/login"],
    ["Request verification link", "/auth-preview/verify-email"],
    ["Request a new reset link", "/forgot-password"],
  ]) {
    await roleNavigate(page, "/review/feedback");
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${target}$`));
  }
  await roleNavigate(page, "/review/staff-review");
  await page.getByRole("button", { name: "Open ownership proof" }).click();
  await expect(page).toHaveURL(/staff\/document$/);
  await roleNavigate(page, "/staff/property");
  await page.getByRole("button", { name: "Menu", exact: true }).first().click();
  await page.getByRole("link", { name: "Review property submission" }).click();
  await expect(page).toHaveURL(/review\/staff-review$/);
  await roleNavigate(page, "/resources/help");
  await expect(
    page.getByRole("link", { name: /Recovery feedback|360 px responsive/ }),
  ).toHaveCount(0);
  await roleNavigate(page, "/review/feedback");
  await expect(page).toHaveURL(/review\/feedback$/);
});
test("responsive source references are accessible and their product menu restores focus", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [360, 768, 1280])
    for (const slug of ["staff-review", "landlord-approval", "feedback"]) {
      await page.setViewportSize({ width, height: 844 });
      await roleNavigate(page, `/review/${slug}`);
      expect(
        await page
          .locator(".journey-body")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
  for (const slug of [
    "staff-review",
    "landlord-approval",
    "publication-review",
    "feedback",
  ]) {
    await roleNavigate(page, `/review/${slug}`);
    const issues = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(issues).toEqual([]);
  }
  await roleNavigate(page, "/review/staff-review");
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
