import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("landlord form has real empty states, preserves edits and never manufactures a receipt from URL parameters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/landlord?preview=1&step=receipt");
  await expect(
    page.getByRole("heading", { name: "Tell us about you.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("");
  await expect(page.getByText("SUB-2026-000123", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Full name", { exact: true }).fill("Fictional owner");
  await page.getByLabel("Phone number", { exact: true }).fill("08012345678");
  await page
    .getByLabel("Relationship to property", { exact: true })
    .selectOption("owner");
  await page
    .getByRole("button", { name: "Continue to property", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Introduce your property.",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Fictional owner",
  );
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .locator("body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});
test("file constraints are visible without sending data and direct upload/review links cannot bypass required details", async ({
  page,
}) => {
  let drafts = 0;
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/api/v1/landlord-submissions"
    )
      drafts++;
  });
  await page.goto("/landlord?step=uploads");
  await page
    .getByLabel("Select property photos", { exact: true })
    .setInputFiles({
      name: "bad.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "not supported" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review my listing", exact: true })
    .click();
  await expect(
    page.locator(".listing-error").filter({ hasText: "at least 5" }),
  ).toBeVisible();
  expect(drafts).toBe(0);
});
