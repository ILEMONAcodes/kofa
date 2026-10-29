import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const steps = [
  "contact",
  "property",
  "pricing",
  "features",
  "uploads",
  "review",
  "receipt",
  "verification",
];
test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("kofa-launch-seen", "1"),
  );
});
test("eight listing frames match source geometry and accessible assets", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const step of steps) {
    await page.goto(`/landlord?preview=1&step=${step}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".listing-form h1")).toBeVisible();
    expect((await page.locator(".listing-form h1").boundingBox())?.y).toBe(164);
    expect((await page.locator(".auth-actions").boundingBox())?.y).toBe(690);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    for (const image of await page.locator(".auth-header img").all())
      expect(
        await image.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      ).toBeTruthy();
    if (step === "verification") {
      expect(
        (await page.locator(".listing-form h1").boundingBox())?.height,
      ).toBe(38);
      expect(
        (await page.locator(".listing-verification-step").first().boundingBox())
          ?.y,
      ).toBe(314);
    }
    if (step === "pricing") {
      await expect(page.locator(".listing-currency").first()).toHaveText("₦");
      const spacing = await page
        .locator(".listing-money")
        .first()
        .evaluate((element) => {
          const input = element.querySelector("input")!;
          const prefix = element.querySelector(".listing-currency")!;
          return {
            textStart:
              input.getBoundingClientRect().left +
              parseFloat(getComputedStyle(input).paddingLeft),
            prefixEnd: prefix.getBoundingClientRect().right,
            textEnd:
              input.getBoundingClientRect().right -
              parseFloat(getComputedStyle(input).paddingRight),
            stepperStart: element
              .querySelector("button")!
              .getBoundingClientRect().left,
          };
        });
      expect(spacing.textStart).toBeGreaterThan(spacing.prefixEnd);
      expect(spacing.textEnd).toBeLessThan(spacing.stepperStart);
    }
    if (step === "contact")
      expect(
        (await page.getByLabel("Full name", { exact: true }).boundingBox())?.y,
      ).toBe(322);
    if (step === "uploads") {
      const photo = page.locator(".listing-thumbnails img").first();
      expect(await photo.getAttribute("src")).toBe(
        "/assets/home-living-room.jpg",
      );
      const box = await photo.boundingBox();
      expect(box?.x).toBe(41);
      expect(box?.y).toBe(473);
      expect(box?.width).toBe(110);
      expect(box?.height).toBe(84);
    }
    await page.screenshot({ path: `test-results/listing-${step}-390.png` });
  }
});
test("wizard preserves details, edits, Other preferences and browser history without requests", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/landlord");
  await page
    .getByRole("button", { name: "Continue to property", exact: true })
    .click();
  await expect(page).toHaveURL(/\/landlord$/);
  await page.getByLabel("Full name", { exact: true }).fill("Sample owner");
  await page.getByLabel("Phone number", { exact: true }).fill("+2348012345678");
  await page
    .getByLabel("Relationship to property", { exact: true })
    .selectOption("other");
  await page
    .getByLabel("Relationship to property — specify your preference", {
      exact: true,
    })
    .fill("Authorised family representative");
  await page
    .getByRole("button", { name: "Continue to property", exact: true })
    .click();
  await expect(page).toHaveURL(/step=property/);
  await page
    .getByLabel("Listing title", { exact: true })
    .fill("Bright apartment in Wuse 2");
  await page
    .getByLabel("Neighbourhood", { exact: true })
    .selectOption("Wuse 2");
  await page
    .getByLabel("Exact address (private)", { exact: true })
    .fill("12 Sample Street");
  await page
    .getByLabel("Property description", { exact: true })
    .fill("A bright apartment with generous space and natural light.");
  await page
    .getByRole("button", { name: "Continue to pricing", exact: true })
    .click();
  await page.getByLabel("Price in naira", { exact: true }).fill("3,500,000");
  await page
    .getByRole("button", { name: "Increase price in naira by 100,000 naira" })
    .click();
  await expect(page.getByLabel("Price in naira", { exact: true })).toHaveValue(
    "3,600,000",
  );
  await page
    .getByRole("button", { name: "Continue to features", exact: true })
    .click();
  await page.getByLabel("Bedrooms", { exact: true }).selectOption("1");
  await page.getByLabel("Bathrooms", { exact: true }).selectOption("1");
  await page
    .getByRole("button", { name: "Continue to photos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review my listing", exact: true })
    .click();
  await expect(page.locator('.listing-error[role="alert"]')).toContainText(
    "at least 5 property photos",
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/step=uploads/);
  await page.goBack();
  await expect(page).toHaveURL(/step=features/);
  await expect(page.getByLabel("Bedrooms", { exact: true })).toHaveValue("1");
  expect(posts).toEqual([]);
});
test("media can be selected, reordered, removed and retained between review and edit", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/landlord?preview=1&step=uploads");
  await page
    .getByLabel("Select property photos", { exact: true })
    .setInputFiles({
      name: "test-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(
    page.getByRole("heading", { name: "Property photos · 6 ready" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Manage photo 1, cover", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move Sample photo 1 later", exact: true })
    .click();
  await expect(
    page.locator(".listing-media-manager > div").first(),
  ).toContainText("Sample photo 2 · Cover");
  await page
    .getByRole("button", { name: "Remove Sample photo 5", exact: true })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByLabel("Select private ownership evidence", { exact: true })
    .setInputFiles({
      name: "sample-proof.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 sample"),
    });
  await page
    .getByLabel("Select optional walkthrough video", { exact: true })
    .setInputFiles({
      name: "sample-walkthrough.webm",
      mimeType: "video/webm",
      buffer: Buffer.from("sample preview"),
    });
  await expect(
    page.getByText(/sample-walkthrough.webm · Sample only/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review my listing", exact: true })
    .click();
  await expect(page).toHaveURL(/step=review/);
  await page
    .getByRole("button", { name: "Edit photos and evidence", exact: true })
    .click();
  await expect(page).toHaveURL(/step=uploads/);
  const added = page.locator('.listing-thumbnails img[alt="test-photo.png"]');
  expect(
    await added.evaluate(
      (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
    ),
  ).toBeTruthy();
  await page
    .getByLabel("Select property photos", { exact: true })
    .setInputFiles({
      name: "blocked.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await expect(page.locator('.listing-error[role="alert"]')).toContainText(
    "not supported",
  );
  await expect(
    page.getByRole("button", { name: "Retry file selection" }),
  ).toBeVisible();
  expect(posts).toEqual([]);
});
test("review uses explicit consent and unavailable service rather than a fake receipt", async ({
  page,
}) => {
  await page.goto("/landlord?preview=1&step=review");
  await page
    .getByLabel(
      "I agree to the Terms and Privacy Policy for this submission.",
      { exact: true },
    )
    .uncheck();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByLabel(
      "I agree to the Terms and Privacy Policy for this submission.",
      { exact: true },
    )
    .check();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No files or contact details have been sent",
  );
  await page.getByRole("link", { name: "Preview the sample receipt" }).click();
  await expect(
    page.getByText("Design preview · sample content", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "How verification works", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Verification, step by step.",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/landlord?step=receipt");
  await expect(
    page.getByText("SUB-2026-000123 · Illustrative reference", { exact: true }),
  ).toHaveCount(0);
});
test("short and wide layouts keep all upload controls reachable", async ({
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
    await page.goto("/landlord?preview=1&step=uploads");
    await page
      .getByRole("button", { name: "Add property video", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Add property video", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
