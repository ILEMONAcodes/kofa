import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { reviewLogin } from "./review-helpers";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

test("staff verifies and records owner approval before publishing; edits invalidate approval", async ({
  page,
}) => {
  test.setTimeout(240000);
  await reviewLogin(page, "staff");
  const csrf = (await page.context().cookies()).find(
    (c) => c.name === "csrf_token",
  )!.value;
  const headers = { Origin: "http://127.0.0.1:3100", "X-CSRF-Token": csrf };
  // Guarded fictional fixture, never a Neon/production connection.
  const id = execFileSync(
    resolve("../backend/.venv/bin/python"),
    ["-m", "tests.seed_workflow_e2e"],
    { cwd: resolve("../backend"), encoding: "utf8" },
  ).trim();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/staff/property?id=${id}`);
  const listingAction = () =>
    page.getByLabel("Listing action", { exact: true });
  async function transition(action: string, reason?: string) {
    await listingAction().selectOption(action);
    await page
      .getByRole("button", { name: "Continue with action", exact: true })
      .click();
    if (reason)
      await page
        .getByRole("dialog")
        .getByLabel("Reason", { exact: true })
        .fill(reason);
    await page
      .getByRole("dialog")
      .getByRole("button", {
        name: `Confirm ${action.replaceAll("_", " ")}`,
        exact: true,
      })
      .click();
    await expect(page.locator(".staff-live").getByRole("status")).toContainText(
      "completed.",
    );
  }
  await expect(listingAction().locator('option[value="publish"]')).toHaveCount(
    0,
  );
  await transition("start_review");
  await page
    .getByLabel("Verification scope", { exact: true })
    .fill(
      "Identity, ownership documents, location, price and features checked.",
    );
  for (const code of [
    "Identity",
    "Ownership docs",
    "Location",
    "Price",
    "Features",
  ]) {
    await page
      .getByLabel(`${code} result`, { exact: true })
      .selectOption("pass");
  }
  await page
    .getByRole("button", { name: "Save verification checklist", exact: true })
    .click();
  await expect(
    page.getByText(
      "Verification checklist saved. Complete it when the review is finished.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Complete verification as passed",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Verification passed.", { exact: true }),
  ).toBeVisible();
  await expect(listingAction().locator('option[value="approve"]')).toHaveCount(
    0,
  );
  const approvedAt = new Date(Date.now() - 120000 + 3600000)
    .toISOString()
    .slice(0, 16);
  async function ownerApproval() {
    await page
      .getByLabel("Approval date and time (WAT)", { exact: true })
      .fill(approvedAt);
    await page
      .getByLabel(
        "The landlord approved the current advertised price and description.",
        { exact: true },
      )
      .check();
    await page
      .getByRole("button", { name: "Record landlord approval", exact: true })
      .click();
    await expect(
      page.getByText("Landlord approval recorded.", { exact: true }),
    ).toBeVisible();
  }
  await ownerApproval();
  await transition("approve");
  await page.getByRole("link", { name: "Edit listing", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill(
      "Revised property description agreed with the owner before publication.",
    );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Changes saved. Fresh landlord approval is required.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Property details", exact: true })
    .click();
  await expect(listingAction().locator('option[value="publish"]')).toHaveCount(
    0,
  );
  const current = (
    await (await page.request.get(`/api/v1/admin/properties/${id}`)).json()
  ).data;
  const invalid = await page.request.post(
    `/api/v1/admin/properties/${id}/transitions`,
    { headers, data: { action: "publish", version: current.version } },
  );
  expect(invalid.status()).toBe(409);
  await ownerApproval();
  await transition("publish");
  let record = (
    await (await page.request.get(`/api/v1/admin/properties/${id}`)).json()
  ).data;
  expect(record.status).toBe("published");
  expect(record.published_at).toBeTruthy();
  expect(record.is_verified).toBe(true);
  await transition("unpublish", "Availability requires a new confirmation.");
  record = (
    await (await page.request.get(`/api/v1/admin/properties/${id}`)).json()
  ).data;
  expect(record.status).toBe("unpublished");
  await transition("archive");
  await expect(listingAction()).toHaveCount(0);
  await reviewLogin(page, "admin");
  await page.goto(`/staff/property?id=${id}`);
  await transition("reopen", "Owner supplied updated information.");
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page
        .locator(".journey-body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  const result = await new AxeBuilder({ page })
    .include(".staff-live")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.screenshot({ path: "/tmp/kofa-workflow-desktop.png" });
});
