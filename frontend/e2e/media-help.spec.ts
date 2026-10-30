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
  readFileSync("src/components/features/media-help/screens.json", "utf8"),
);
for (let start = 0; start < screens.length; start += 10) {
  test(`media help source screens ${start + 1}–${Math.min(start + 10, 39)}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const s of screens.slice(start, start + 10)) {
      await page.goto(`/media-help-preview/${s.slug}`);
      await expect(page.locator(".mobile-launch")).toBeHidden();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        s.blocks[1].text!,
      );
      const body = page.locator(".journey-body");
      expect(
        await body.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      const content = await body.innerText();
      const check = (bs: Block[]) =>
        bs.forEach((b) => {
          if (b.type === "text") expect(content).toContain(b.text);
          if (b.children) check(b.children);
        });
      check(s.blocks);
      for (const image of await body.locator("img[data-source-node]").all()) {
        await expect(image).toBeVisible();
        const geometry = await image.evaluate((e: HTMLImageElement) => ({
          width: e.getBoundingClientRect().width,
          height: e.getBoundingClientRect().height,
          loaded: e.complete && e.naturalWidth > 0,
        }));
        expect(geometry.loaded).toBe(true);
        expect(geometry.width).toBeGreaterThan(0);
        const id = await image.getAttribute("data-source-node");
        const flatten = (bs: Block[]): Block[] =>
          bs.flatMap((b) => [b, ...flatten(b.children ?? [])]);
        const expected = flatten(s.blocks).find((b) => b.id === id)!;
        expect(geometry.height).toBe(expected.height);
        expect(geometry.width).toBeCloseTo(
          ["82:2528", "82:2529", "82:2530"].includes(id!)
            ? 111.3333
            : s.slug === "walkthrough" || id === "82:2593"
              ? 318
              : 350,
          0,
        );
      }
      if (
        [
          "media",
          "gallery",
          "assistant",
          "terms",
          "loading",
          "accessibility",
        ].includes(s.slug)
      )
        await page.screenshot({ path: `/tmp/kofa-media-${s.slug}.png` });
    }
  });
}
test("report Other validation and separate fictional result send no mutations", async ({
  page,
}) => {
  let mutations = 0;
  page.on("request", (r) => {
    if (["POST", "PATCH", "DELETE", "PUT"].includes(r.method())) mutations++;
  });
  await page.goto("/media-help-preview/report");
  await page.getByLabel("Reason", { exact: true }).selectOption("Other");
  await expect(page.getByLabel("Specify reason")).toBeVisible();
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Service not connected" }),
  ).not.toBeVisible();
  await page.getByLabel("Specify reason").fill("The photos do not match");
  await page
    .getByLabel("Describe the concern")
    .fill("The advertised interior photographs do not match this property.");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Service not connected" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Preview example outcome" }).click();
  await expect(page).toHaveURL(/report-received$/);
  expect(mutations).toBe(0);
});
test("gallery, help policies and numbered directory are connected", async ({
  page,
}) => {
  await page.goto("/media-help-preview/gallery");
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(page).toHaveURL(/gallery-photo$/);
  await page
    .getByRole("button", { name: "Previous photo", exact: true })
    .click();
  await expect(page).toHaveURL(/gallery$/);
  await page.goto("/media-help-preview/help");
  await page.getByRole("button", { name: "View details →" }).nth(4).click();
  await expect(page).toHaveURL(/privacy$/);
  await expect(page.getByRole("note")).toContainText("Draft");
  await page
    .getByRole("button", { name: "View all 39 media and help screens" })
    .click();
  await expect(page.getByRole("dialog").locator("ol li")).toHaveCount(39);
});
test("local file constraints, removal and session persistence", async ({
  page,
}) => {
  await page.goto("/media-help-preview/media");
  await page
    .getByRole("button", { name: "Choose property photos", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Manage local media",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await page.getByLabel("Select optional walkthrough video").setInputFiles({
    name: "invalid.mov",
    mimeType: "video/quicktime",
    buffer: Buffer.from("test"),
  });
  await expect(modal.getByRole("alert")).toBeVisible();
  await modal.getByRole("button", { name: "Dismiss file error" }).click();
  await page.getByLabel("Select optional walkthrough video").setInputFiles({
    name: "sample.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("local preview only"),
  });
  await expect(modal.getByText("sample.webm · Selected locally")).toBeVisible();
  await modal.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview selected photo", exact: true })
    .click();
  await expect(page).toHaveURL(/photo-preview$/);
  await page.getByLabel("Caption", { exact: true }).fill("Sample caption");
  await page.getByRole("button", { name: "Use as cover", exact: true }).click();
  await expect(
    page.getByLabel("Selected photo caption (optional)"),
  ).toHaveValue("Sample caption");
  await page
    .getByRole("button", { name: "Choose or replace video", exact: true })
    .click();
  await expect(modal.getByText("sample.webm · Selected locally")).toBeVisible();
  await modal
    .getByRole("button", { name: "Remove video", exact: true })
    .click();
  await expect(
    modal.getByText("sample.webm · Selected locally"),
  ).not.toBeVisible();
});
test("responsive geometry, disabled support call and accessibility", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/media-help-preview/media");
    expect(
      await page
        .locator(".journey-body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  for (const slug of [
    "report",
    "assistant",
    "terms",
    "accessibility",
    "media",
  ]) {
    await page.goto(`/media-help-preview/${slug}`);
    await expect(page.locator(".mobile-launch")).toBeHidden();
    const issues = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(issues).toEqual([]);
  }
  await page.goto("/media-help-preview/assistant");
  await expect(
    page.getByRole("button", { name: "Call team · Number not set" }),
  ).toBeDisabled();
  expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
  await page.goto("/media-help-preview/accessibility");
  await expect(page.getByLabel("Email · Disabled example")).toBeDisabled();
  await expect(page.getByLabel("Email · Error example")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});

test("source-specific workspace navigation and persistent listing actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/media-help-preview/conflict");
  await expect(
    page.getByRole("button", { name: "Help", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Overview" }),
  ).toHaveAttribute("href", "/staff-preview/overview");
  await page.getByRole("button", { name: "Menu", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }).first(),
  ).toBeFocused();
  await page.goto("/media-help-preview/media");
  const actions = page.locator(".media-listing-actions");
  expect((await actions.boundingBox())!.height).toBe(154);
  await expect(actions).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await actions.getByRole("button", { name: "Back to features" }).click();
  await expect(page).toHaveURL(/landlord.*step=features/);
});

test("private report evidence enforces its separate three-file cap", async ({
  page,
}) => {
  await page.goto("/media-help-preview/report");
  await page.getByRole("button", { name: "Add evidence", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Private report evidence" });
  await expect(modal).toBeVisible();
  await expect(modal.getByText("Property photos", { exact: true })).toHaveCount(
    0,
  );
  const files = Array.from({ length: 4 }, (_, i) => ({
    name: `sample-${i}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF sample"),
  }));
  await modal.getByLabel("Select report evidence").setInputFiles(files);
  await expect(modal.getByRole("alert")).toContainText("at most 3");
  await modal
    .getByLabel("Select report evidence")
    .setInputFiles(files.slice(0, 3));
  await expect(modal.getByText(/Private · Selected locally/)).toHaveCount(3);
  await modal.getByRole("button", { name: "Remove evidence 1" }).click();
  await expect(modal.getByText(/Private · Selected locally/)).toHaveCount(2);
  await modal
    .getByRole("link", { name: "Preview evidence attached state" })
    .click();
  await expect(page).toHaveURL(/report-evidence$/);
});

test("empty-state edit filters opens the existing mobile filter sheet", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/media-help-preview/empty");
  await page.getByRole("button", { name: "Edit filters", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Make it your search" }),
  ).toBeVisible();
});
