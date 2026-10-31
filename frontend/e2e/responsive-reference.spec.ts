import { reviewLogin } from "./review-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const screens = JSON.parse(
  readFileSync(
    new URL(
      "../src/components/features/responsive-reference/screens.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { slug: string; blocks: { text?: string }[] }[];
test("all seven 360 px references retain content, geometry and accessible controls", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const screen of screens) {
      await roleNavigate(page, `/responsive-preview/${screen.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        screen.blocks[1].text!,
      );
      expect(
        await page
          .locator(".journey-body")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await expect(page.locator(".journey-nav")).toBeVisible();
      if (width === 360) {
        const button = page.locator(".journey-header button").first();
        expect((await button.boundingBox())!.width).toBe(120);
        expect((await page.locator(".journey-body").boundingBox())!.width).toBe(
          360,
        );
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        if (screen.slug === "media") {
          const images = page.locator(".journey-body img[data-source-node]");
          await expect(images).toHaveCount(4);
          for (let i = 0; i < 4; i++) {
            const img = images.nth(i);
            await img.scrollIntoViewIfNeeded();
            expect(
              await img.evaluate(
                (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
              ),
            ).toBe(true);
            const box = (await img.boundingBox())!;
            expect(box.width).toBeCloseTo(i < 3 ? 101.333 : 288, 1);
            expect(box.height).toBe(i < 3 ? 110 : 180);
          }
          await page
            .locator(".journey-scroll")
            .evaluate((el) => (el.scrollTop = 0));
        }
        await page.screenshot({ path: `/tmp/kofa-360-${screen.slug}.png` });
      }
    }
  }
});
test("budgets step by 100000 and reject reversed ranges; Other remains editable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await roleNavigate(page, "/responsive-preview/inquiry");
  await page
    .getByRole("button", {
      name: "Increase minimum budget (₦) by 100,000 naira",
    })
    .click();
  await expect(
    page.getByLabel("Minimum budget (₦)", { exact: true }),
  ).toHaveValue("3,100,000");
  await page
    .getByLabel("Minimum budget (₦)", { exact: true })
    .fill("5,000,000");
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page.locator(".journey-body").getByRole("alert")).toContainText(
    "minimum",
  );
  await page.getByLabel("Request type", { exact: true }).selectOption("Other");
  await expect(page.getByLabel("Specify request type")).toBeVisible();
});
test("queue filters and message refresh stay local; investigation requires findings", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()))
      mutations.push(request.url());
  });
  await roleNavigate(page, "/responsive-preview/properties");
  await page.getByLabel("Area", { exact: true }).selectOption("Jabi");
  await expect(page.locator('[data-source-node="94:16215"]')).toBeVisible();
  await expect(page.locator('[data-source-node="94:16203"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator('[data-source-node="94:16203"]')).toBeVisible();
  await roleNavigate(page, "/responsive-preview/conversation");
  await page.getByRole("button", { name: "Refresh messages" }).click();
  await expect(page.getByRole("status")).toContainText("currently unavailable");
  await roleNavigate(page, "/responsive-preview/investigation");
  await page.getByRole("button", { name: "Save working record" }).click();
  await expect(page.getByLabel("Findings", { exact: true })).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(mutations).toEqual([]);
});

test("media preview and removal keep a single local dialog and persistent metadata", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await roleNavigate(page, "/responsive-preview/media");
  await page
    .getByLabel("Selected photo caption (optional)", { exact: true })
    .fill("My local room");
  await page
    .getByRole("button", { name: "Preview selected photo", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("dialog").getByText("My local room", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use as cover", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove selected photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".journey-body").getByRole("status")).toContainText(
    "removed locally",
  );
  await expect(page.locator(".media-listing-actions")).toHaveCount(0);
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
