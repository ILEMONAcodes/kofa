import { liveStaffViews } from "../src/components/features/live-staff/model";
import { reviewLogin } from "./review-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, existsSync } from "node:fs";
type Block = {
  id: string;
  type: string;
  text?: string;
  src?: string;
  height?: number;
  children?: Block[];
};
const sourceScreens: { slug: string; blocks: Block[] }[] = JSON.parse(
  readFileSync("src/components/features/staff-operations/screens.json", "utf8"),
);
const screens = sourceScreens.filter(
  (screen) => !liveStaffViews.includes(screen.slug),
);
for (let start = 0; start < screens.length; start += 10) {
  const group = screens.slice(start, start + 10);
  test(`source mobile screens ${start + 1}–${start + group.length} render completely`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const screen of group) {
      await page.goto(`/staff/${screen.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        screen.blocks[1].text!,
      );
      await expect(page.locator(".mobile-launch")).toBeHidden();
      expect(
        await page
          .locator(".journey-body")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const brand = await page.locator(".staff-brand").boundingBox();
      expect(brand!.width).toBeCloseTo(101.15, 1);
      expect(brand!.height).toBeCloseTo(32.7833, 1);
      for (const icon of await page.locator(".journey-nav img").all()) {
        const box = await icon.boundingBox();
        expect(box!.width).toBe(22);
        expect(box!.height).toBe(22);
      }
      const images: Block[] = [];
      function collect(blocks: Block[]) {
        blocks.forEach((block) => {
          if (block.type === "image") images.push(block);
          if (block.children) collect(block.children);
        });
      }
      collect(screen.blocks);
      for (const image of images) {
        expect(existsSync(`public${image.src}`)).toBe(true);
        const photo = page.locator(`img[data-source-node="${image.id}"]`);
        await photo.scrollIntoViewIfNeeded();
        await expect(photo).toBeVisible();
        expect((await photo.boundingBox())!.height).toBeCloseTo(
          image.height!,
          0,
        );
        expect(
          await photo.evaluate(
            (el) =>
              (el as HTMLImageElement).complete &&
              (el as HTMLImageElement).naturalWidth > 0,
          ),
        ).toBe(true);
      }
      if (
        ["overview", "evidence", "media", "calendar", "edit-property"].includes(
          screen.slug,
        )
      ) {
        await page
          .locator(".journey-scroll")
          .evaluate((el) => (el.scrollTop = 0));
        await page.screenshot({
          path: `/tmp/kofa-staff-${screen.slug}-390.png`,
        });
      }
    }
  });
}
test("staff menu connects live directories without sample records", async ({
  page,
}) => {
  await page.goto("/staff/overview");
  await page.getByRole("button", { name: "Menu", exact: true }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Properties", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Property submissions",
  );
  await expect(page.getByLabel("Neighbourhood", { exact: true })).toBeVisible();
  await page.goto("/staff/edit-property");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Choose a property",
  );
});
test("private notes and reply are distinct and never sent by the preview", async ({
  page,
}) => {
  await page.goto("/staff/inquiry");
  await page
    .getByLabel("Reply to client", { exact: true })
    .fill("Please share a preferred date.");
  await page
    .getByRole("button", { name: "Send client reply", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Nothing was submitted");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Qualification & internal notes",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Staff-only information · Never shown in the client thread",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Internal note", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Reply to client", { exact: true })).toHaveCount(
    0,
  );
});
test("staff preview fits short mobile and desktop review widths", async ({
  page,
}) => {
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 640 });
    await page.goto("/staff/schedule-inspection");
    expect(
      await page
        .locator(".journey-body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Schedule inspection", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Schedule inspection", exact: true }),
    ).toBeVisible();
  }
});
test("staff forms, media and calendar have no serious accessibility violations", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of [
    "properties",
    "media",
    "qualification",
    "schedule-inspection",
    "calendar",
  ]) {
    await page.goto(`/staff/${slug}`);
    await expect(page.locator(".mobile-launch")).toBeHidden();
    const result = await new AxeBuilder({ page })
      .include(".staff-preview")
      .analyze();
    expect(
      result.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  }
});

test.beforeEach(async ({ page }) => {
  await reviewLogin(page, "admin");
  await page.addInitScript(() => {
    sessionStorage.setItem("kofa-launch-seen", "1");
  });
});
