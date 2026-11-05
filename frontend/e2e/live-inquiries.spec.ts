import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { reviewLogin } from "./review-helpers";

test("client inquiry, staff reply/private note/qualification and client directory work on the real stack", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await page.clock.install();
  await reviewLogin(page, "client");
  await page.goto("/account/general-inquiry");
  await page
    .getByLabel("Your message", { exact: true })
    .fill("I would like help finding a home in Abuja.");
  await page
    .getByLabel("Minimum budget (₦)", { exact: true })
    .fill("1,000,000");
  await page
    .getByLabel("Maximum budget (₦)", { exact: true })
    .fill("3,000,000");
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/conversation\?id=/);
  const id = new URL(page.url()).searchParams.get("id")!;
  await expect(
    page.getByText("I would like help finding a home in Abuja.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Your reply", { exact: true })
    .fill("A quiet neighbourhood would be ideal.");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    page.getByText("A quiet neighbourhood would be ideal.", { exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const staff = await context.newPage();
  await reviewLogin(staff, "staff");
  await staff.goto("/staff/inquiries");
  await staff.getByLabel("Search inquiries").fill(id);
  await expect(
    staff.getByText("2 unread messages", { exact: true }),
  ).toBeVisible();
  await staff.locator("a.inquiry-card").first().click();
  await expect(
    staff.getByText("I would like help finding a home in Abuja.", {
      exact: true,
    }),
  ).toBeVisible();
  await staff
    .getByRole("button", { name: "Assign to me", exact: true })
    .click();
  await expect(staff.getByText(/Assigned to:/)).not.toContainText("Unassigned");
  await staff
    .getByLabel("Private note", { exact: true })
    .fill("CONFIDENTIAL qualification detail not for the client.");
  await staff
    .getByRole("button", { name: "Save internal note", exact: true })
    .click();
  await expect(
    staff.getByText("CONFIDENTIAL qualification detail not for the client.", {
      exact: true,
    }),
  ).toBeVisible();
  await staff
    .getByLabel("Reply to client", { exact: true })
    .fill("We can help. Which area would you prefer?");
  await staff.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    staff.getByText("We can help. Which area would you prefer?", {
      exact: true,
    }),
  ).toBeVisible();
  await staff.getByLabel("Status action").selectOption("start");
  await staff
    .getByRole("button", { name: "Update inquiry", exact: true })
    .click();
  await expect(staff.getByLabel("Status action")).toHaveValue("qualify");
  await staff
    .getByLabel("Minimum budget (₦)", { exact: true })
    .fill("1,500,000");
  await staff
    .getByRole("button", { name: "Save qualification", exact: true })
    .click();
  await expect(
    staff.getByLabel("Minimum budget (₦)", { exact: true }),
  ).toHaveValue("1,500,000");
  await page.clock.fastForward(31000);
  await expect(
    page.getByText("We can help. Which area would you prefer?", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("CONFIDENTIAL qualification detail not for the client."),
  ).toHaveCount(0);
  for (const suffix of ["", "/messages"]) {
    const response = await page.request.get(`/api/v1/inquiries/${id}${suffix}`);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).not.toContain("CONFIDENTIAL");
  }
  expect(
    (await page.request.get(`/api/v1/admin/inquiries/${id}/notes`)).status(),
  ).toBe(403);
  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  await reviewLogin(other, "client");
  expect((await other.request.get(`/api/v1/inquiries/${id}`)).status()).toBe(
    404,
  );
  await stranger.close();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const violations = (
    await new AxeBuilder({ page }).analyze()
  ).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "/tmp/kofa-inquiry-client.png",
    fullPage: true,
  });
  await staff.evaluate(() => window.scrollTo(0, 0));
  await staff.screenshot({
    path: "/tmp/kofa-inquiry-staff.png",
    fullPage: true,
  });
  await staff.goto("/staff/clients");
  await staff.locator("a.inquiry-card").first().click();
  await expect(
    staff.getByRole("heading", { name: "Recent inquiries" }),
  ).toBeVisible();
  await context.close();
});

test("published property links to a real inquiry and duplicate interest remains one conversation", async ({
  page,
}) => {
  test.setTimeout(120000);
  await reviewLogin(page, "staff");
  const records = JSON.parse(
    execFileSync(
      resolve("../backend/.venv/bin/python"),
      ["-m", "tests.seed_public_e2e"],
      { cwd: resolve("../backend"), encoding: "utf8" },
    ),
  );
  const record = records[0];
  const csrf = (await page.context().cookies()).find(
    (c) => c.name === "csrf_token",
  )!.value;
  const detail = (
    await (
      await page.request.get(`/api/v1/admin/properties/${record.id}`)
    ).json()
  ).data;
  const published = await page.request.post(
    `/api/v1/admin/properties/${record.id}/transitions`,
    {
      headers: { Origin: "http://127.0.0.1:3100", "X-CSRF-Token": csrf },
      data: { action: "publish", version: detail.version },
    },
  );
  expect(published.status(), await published.text()).toBe(200);
  await reviewLogin(page, "client");
  await page.goto(`/properties/${record.slug}`);
  await page
    .getByRole("link", { name: /Express interest|Request inspection/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/account\/inquiry\?/);
  await expect(page.getByText(record.title, { exact: true })).toBeVisible();
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Please help me inspect this home.");
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page).toHaveURL(/conversation\?id=/);
  await page.goto(`/account/inquiry?property=${record.slug}`);
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Another inspection request.");
  await page.getByRole("button", { name: "Send inquiry", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "already have an open inquiry",
  );
  await page.goto("/account/inquiries");
  await expect(page.getByText(record.title, { exact: true })).toHaveCount(1);
});
