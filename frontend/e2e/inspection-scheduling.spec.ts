import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { reviewLogin } from "./review-helpers";
const day = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function csrf(page: Page) {
  await page.request.get("/api/v1/auth/csrf");
  return {
    Origin: "http://127.0.0.1:3100",
    "X-CSRF-Token": (await page.context().cookies()).find(
      (c) => c.name === "csrf_token",
    )!.value,
  };
}

test("real inspection flow enforces conflicts, scoped address confirmation, rescheduling, outcomes and cancellation", async ({
  page: staff,
  browser,
}) => {
  test.setTimeout(240000);
  await reviewLogin(staff, "staff");
  const headers = await csrf(staff);
  const account = (await (await staff.request.get("/api/v1/auth/me")).json())
    .data;
  const records = JSON.parse(
    execFileSync(
      resolve("../backend/.venv/bin/python"),
      ["-m", "tests.seed_public_e2e"],
      { cwd: resolve("../backend"), encoding: "utf8" },
    ),
  );
  const property = records[0];
  const image = readFileSync(resolve("public/assets/home-living-room.jpg"));
  expect(
    (
      await staff.request.post(
        `/api/v1/admin/properties/${property.id}/media`,
        {
          headers,
          multipart: {
            kind: "photo",
            file: {
              name: "courtyard.jpg",
              mimeType: "image/jpeg",
              buffer: image,
            },
          },
        },
      )
    ).status(),
  ).toBe(201);
  const detail = (
    await (
      await staff.request.get(`/api/v1/admin/properties/${property.id}`)
    ).json()
  ).data;
  expect(
    (
      await staff.request.post(
        `/api/v1/admin/properties/${property.id}/transitions`,
        { headers, data: { version: detail.version, action: "publish" } },
      )
    ).status(),
  ).toBe(200);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const client = await context.newPage();
  await reviewLogin(client, "client");
  await client.goto(`/account/inquiry?property=${property.slug}`);
  await client.getByLabel("Request type").selectOption("inspection_request");
  await client
    .getByLabel("Your message", { exact: true })
    .fill("Please arrange a viewing of this home.");
  await client
    .getByRole("button", { name: "Send inquiry", exact: true })
    .click();
  await expect(client).toHaveURL(/conversation\?id=/);
  const inquiryId = new URL(client.url()).searchParams.get("id")!;
  await staff.goto(`/staff/inquiry?id=${inquiryId}`);
  for (const action of ["start", "qualify"]) {
    await staff.getByLabel("Status action").selectOption(action);
    await staff
      .getByRole("button", { name: "Update inquiry", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (
            await (
              await staff.request.get(`/api/v1/admin/inquiries/${inquiryId}`)
            ).json()
          ).data.status,
      )
      .toBe(action === "start" ? "in_progress" : "qualified");
  }
  await staff
    .getByRole("link", { name: "Schedule inspection", exact: true })
    .click();
  await staff
    .getByLabel("Kof’a representative", { exact: true })
    .selectOption(account.id);
  await staff.getByLabel("Inspection date (WAT)").fill(day(2));
  await staff
    .getByLabel("Start time (WAT)", { exact: true })
    .selectOption("10:00");
  await staff
    .getByLabel("Meeting instructions", { exact: true })
    .fill("Meet our team at the entrance.");
  await expect(
    staff.getByText("No inspection fee applies to this appointment.", {
      exact: false,
    }),
  ).toBeVisible();
  await staff.setViewportSize({ width: 390, height: 844 });
  await staff.locator(".inspection-scroll").evaluate((el) => el.scrollTo(0, 0));
  await expect(staff.locator(".inspection-logo img")).toBeVisible();
  const staffIssues = (
    await new AxeBuilder({ page: staff }).analyze()
  ).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(staffIssues).toEqual([]);
  await staff.screenshot({
    path: "/tmp/kofa-inspection-schedule.png",
    fullPage: true,
  });
  await staff
    .getByRole("button", { name: "Schedule inspection", exact: true })
    .click();
  await expect(staff).toHaveURL(/\/staff\/inspection\?id=/);
  const id = new URL(staff.url()).searchParams.get("id")!;
  const record = (
    await (await staff.request.get(`/api/v1/admin/appointments/${id}`)).json()
  ).data;
  await client.goto(`/account/inspection-review?id=${id}`);
  await expect(
    client.getByRole("heading", { name: "Your visit is almost set." }),
  ).toBeVisible();
  await expect(
    client.getByText("Exact address available after confirmation.", {
      exact: true,
    }),
  ).toBeVisible();
  const before = await client.request.get(`/api/v1/appointments/${id}`);
  expect((await before.json()).data.meeting_address).toBeNull();
  expect(await before.text()).not.toContain(record.address_line);
  expect(await before.text()).not.toContain(record.landlord_rep_phone);
  const logo = client.locator(".journey-header img");
  await expect(logo).toHaveJSProperty("naturalWidth", 101);
  const box = await logo.boundingBox();
  expect(box?.width).toBeCloseTo(101.15, 1);
  expect(box?.height).toBeCloseTo(32.7833, 1);
  const wrapper = await client.locator(".inspection-logo").boundingBox();
  expect(wrapper?.width).toBe(105);
  expect(wrapper?.height).toBe(35);
  await expect(client.locator(".journey-photo")).toBeVisible();
  const photo = await client.locator(".journey-photo").boundingBox();
  expect(photo?.width).toBe(350);
  expect(photo?.height).toBe(220);
  await client.screenshot({
    path: "/tmp/kofa-inspection-proposed.png",
    fullPage: true,
  });
  await client
    .getByRole("button", { name: "Confirm inspection", exact: true })
    .click();
  await client
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm inspection", exact: true })
    .click();
  await expect(
    client.getByRole("heading", { name: "Meeting address", exact: true }),
  ).toBeVisible();
  await expect(
    client.getByText(record.address_line, { exact: true }),
  ).toBeVisible();
  await client
    .getByRole("button", { name: "Request another time", exact: true })
    .click();
  let dialog = client.getByRole("dialog");
  await dialog
    .getByLabel("Reason", { exact: true })
    .fill("A later date works better.");
  await dialog.getByLabel("Preferred date (WAT)").fill(day(3));
  await dialog.getByRole("button", { name: "Send reschedule request" }).click();
  await expect(
    client.getByRole("heading", { name: "Your request is with us." }),
  ).toBeVisible();
  expect(
    (await (await client.request.get(`/api/v1/appointments/${id}`)).json()).data
      .meeting_address,
  ).toBeNull();
  await staff.getByRole("button", { name: "Refresh inspection" }).click();
  await staff.getByRole("button", { name: "Propose another time" }).click();
  await staff.getByLabel("Inspection date (WAT)").fill(day(3));
  await staff
    .getByLabel("Start time (WAT)", { exact: true })
    .selectOption("11:00");
  await staff
    .getByLabel("Reason for rescheduling")
    .fill("Proposing the requested date.");
  await staff.getByRole("button", { name: "Propose new time" }).click();
  await expect(
    staff.getByRole("heading", { name: "Your visit is almost set." }),
  ).toBeVisible();
  await client.getByRole("button", { name: "Refresh inspection" }).click();
  await expect(
    client.getByRole("heading", { name: "Your visit is almost set." }),
  ).toBeVisible();
  await expect(
    client.getByText(record.address_line, { exact: true }),
  ).toHaveCount(0);
  await client
    .getByRole("button", { name: "Confirm inspection", exact: true })
    .click();
  await client
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm inspection", exact: true })
    .click();
  await expect(
    client.getByRole("heading", { name: "Meeting address" }),
  ).toBeVisible();
  const strangerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const stranger = await strangerContext.newPage();
  await reviewLogin(stranger, "client");
  const otherHeaders = await csrf(stranger);
  expect(
    (await stranger.request.get(`/api/v1/appointments/${id}`)).status(),
  ).toBe(404);
  const otherInquiry = (
    await (
      await stranger.request.post("/api/v1/inquiries", {
        headers: otherHeaders,
        data: {
          kind: "inspection_request",
          property_id: property.id,
          body: "Please arrange my own viewing.",
        },
      })
    ).json()
  ).data;
  for (const [action, version] of [
    ["start", 1],
    ["qualify", 2],
  ] as const)
    expect(
      (
        await staff.request.post(
          `/api/v1/admin/inquiries/${otherInquiry.id}/transitions`,
          { headers, data: { action, version } },
        )
      ).status(),
    ).toBe(200);
  const booked = (
    await (await staff.request.get(`/api/v1/admin/appointments/${id}`)).json()
  ).data;
  const clash = await staff.request.post("/api/v1/admin/appointments", {
    headers,
    data: {
      inquiry_id: otherInquiry.id,
      version: 3,
      staff_id: account.id,
      scheduled_at: booked.scheduled_at,
      duration_minutes: 45,
    },
  });
  expect(clash.status()).toBe(409);
  expect((await clash.json()).error.code).toBe("CONFLICT");
  await staff.getByRole("button", { name: "Refresh inspection" }).click();
  await expect(
    staff.getByRole("button", { name: "Record inspection outcome" }),
  ).toHaveCount(0);
  await expect(
    staff.getByText(`Confirmed meeting address: ${record.address_line}`, {
      exact: true,
    }),
  ).toBeVisible();
  // Guarded local fixture advances only this fictional appointment past its end.
  execFileSync(
    resolve("../backend/.venv/bin/python"),
    ["-m", "tests.inspection_clock_e2e", id],
    { cwd: resolve("../backend"), stdio: "pipe" },
  );
  await staff.getByRole("button", { name: "Refresh inspection" }).click();
  await staff
    .getByRole("button", { name: "Record inspection outcome" })
    .click();
  dialog = staff.getByRole("dialog");
  await dialog.getByLabel("Inspection outcome").selectOption("interested");
  await dialog
    .getByLabel("Internal outcome notes")
    .fill("PRIVATE inspection follow-up note.");
  await dialog.getByRole("button", { name: "Save outcome" }).click();
  await expect(
    staff.getByRole("heading", { name: "Your visit is complete." }),
  ).toBeVisible();
  await client.getByRole("button", { name: "Refresh inspection" }).click();
  await expect(
    client.getByRole("heading", { name: "Your visit is complete." }),
  ).toBeVisible();
  await expect(
    client.getByText("PRIVATE inspection follow-up note."),
  ).toHaveCount(0);
  const publicThread = await client.request.get(`/api/v1/appointments/${id}`);
  expect(await publicThread.text()).not.toContain("PRIVATE");
  expect(await publicThread.text()).not.toContain("landlord_rep_phone");
  for (const width of [360, 768, 1280]) {
    await client.setViewportSize({ width, height: 900 });
    expect(
      await client.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await client
        .locator(".inspection-screen")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await client.setViewportSize({ width: 390, height: 844 });
  const violations = (
    await new AxeBuilder({ page: client }).analyze()
  ).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(violations).toEqual([]);
  await client.screenshot({
    path: "/tmp/kofa-inspection-client.png",
    fullPage: true,
  });
  // The rejected second proposal is still qualified and can use the released slot.
  await staff.goto(`/staff/schedule-inspection?inquiry_id=${otherInquiry.id}`);
  await staff
    .getByLabel("Kof’a representative", { exact: true })
    .selectOption(account.id);
  await staff.getByLabel("Inspection date (WAT)").fill(day(2));
  await staff
    .getByRole("button", { name: "Schedule inspection", exact: true })
    .click();
  await expect(staff).toHaveURL(/\/staff\/inspection\?id=/);
  const secondId = new URL(staff.url()).searchParams.get("id")!;
  await stranger.goto(`/account/inspection-review?id=${secondId}`);
  await stranger
    .getByRole("button", { name: "Cancel visit", exact: true })
    .click();
  dialog = stranger.getByRole("dialog");
  await dialog.getByLabel("Reason", { exact: true }).fill("My plans changed.");
  await dialog.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(
    stranger.getByRole("heading", { name: "Your visit is cancelled." }),
  ).toBeVisible();
  await staff.goto("/staff/calendar");
  await staff
    .getByLabel("Inspection status")
    .selectOption("cancelled_by_client");
  await expect(
    staff.locator("a.inspection-card").filter({ hasText: property.title }),
  ).toHaveCount(1);
  await staff.setViewportSize({ width: 1280, height: 900 });
  await staff.screenshot({
    path: "/tmp/kofa-inspection-calendar.png",
    fullPage: true,
  });
  await strangerContext.close();
  await context.close();
});
