import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { reviewLogin } from "./review-helpers";

test("live admin and staff dashboard counts, dates, refresh, responsive layout and client denial", async ({ page, browser }) => {
  test.setTimeout(120000);
  await reviewLogin(page, "admin");
  const baseline = (await (await page.request.get("/api/v1/admin/reports/kpis")).json()).data.counts;
  const dates = JSON.parse(execFileSync(resolve("../backend/.venv/bin/python"), ["-m", "tests.seed_reports_e2e"], { cwd: resolve("../backend"), encoding: "utf8" }));
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/overview$/);
  const values = [
    ["Listings awaiting review", baseline.listings_awaiting_review + 1],
    ["Open inquiries", baseline.open_inquiries + 2],
    ["Upcoming inspections", baseline.upcoming_inspections + 1],
    ["Active complaints", baseline.active_complaints + 1],
  ] as const;
  for (const [label, value] of values) await expect(page.getByLabel(`${label}: ${value}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administration and team", exact: true })).toBeVisible();
  await page.getByLabel("From date", { exact: true }).fill("2000-01-01");
  await page.getByLabel("To date", { exact: true }).fill("2000-01-01");
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(page.getByText("No matching work to show for these dates.")).toBeVisible();
  for (const [label] of values) await expect(page.getByLabel(`${label}: 0`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  await expect(page.getByLabel(`Open inquiries: ${baseline.open_inquiries + 2}`, { exact: true })).toBeVisible();
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Measure the work that matters." })).toBeVisible();
  await page.getByLabel("From date", { exact: true }).fill(dates.tomorrow);
  await page.getByLabel("To date", { exact: true }).fill(dates.tomorrow);
  await page.getByRole("button", { name: "Apply dates", exact: true }).click();
  await expect(page.getByLabel(`Upcoming inspections: ${baseline.upcoming_inspections + 1}`, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Listings awaiting review: 0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All dates", exact: true }).click();
  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();
  await reviewLogin(client, "client");
  expect((await client.request.get("/api/v1/admin/reports/kpis")).status()).toBe(403);
  await client.request.get("/api/v1/auth/csrf");
  const token = (await clientContext.cookies()).find(cookie => cookie.name === "csrf_token")!.value;
  expect((await client.request.post("/api/v1/inquiries", { headers: { Origin: "http://127.0.0.1:3100", "X-CSRF-Token": token }, data: { kind: "general", body: "A genuine browser fixture inquiry." } })).status()).toBe(201);
  await page.getByRole("button", { name: "Refresh counts", exact: true }).click();
  await expect(page.getByLabel(`Open inquiries: ${baseline.open_inquiries + 3}`, { exact: true })).toBeVisible();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".mobile-launch")).toBeHidden();
    if (width === 1280) expect((await page.locator("main#main-content").boundingBox())!.width).toBeGreaterThan(900);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByLabel(`Open inquiries: ${baseline.open_inquiries + 3}`, { exact: true })).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: "/tmp/kofa-dashboard-desktop.png", fullPage: true });
  await reviewLogin(page, "staff");
  await page.goto("/staff/overview");
  await expect(page.getByLabel(`Open inquiries: ${baseline.open_inquiries + 3}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administration and team", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(page.locator(".mobile-launch")).toBeHidden();
  await page.locator(".journey-scroll").evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: "/tmp/kofa-dashboard-mobile.png", fullPage: true });
  await client.goto("/admin/reports");
  await expect(client.getByRole("heading", { name: "Measure the work that matters." })).toHaveCount(0);
  await clientContext.close();
});
