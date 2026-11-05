import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { reviewLogin } from "./review-helpers";
async function csrf(page: Page) {
  await page.request.get("/api/v1/auth/csrf");
  return {
    Origin: "http://127.0.0.1:3100",
    "X-CSRF-Token": (await page.context().cookies()).find(
      (c) => c.name === "csrf_token",
    )!.value,
  };
}
test("live report and client complaint reach confidential investigation and guarded resolution", async ({
  page: staff,
  browser,
}) => {
  test.setTimeout(240000);
  await reviewLogin(staff, "staff");
  const headers = await csrf(staff);
  const actor = (await (await staff.request.get("/api/v1/auth/me")).json())
    .data;
  const property = JSON.parse(
    execFileSync(
      resolve("../backend/.venv/bin/python"),
      ["-m", "tests.seed_public_e2e"],
      { cwd: resolve("../backend"), encoding: "utf8" },
    ),
  )[0];
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
              name: "property.jpg",
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
  const publicContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    reporter = await publicContext.newPage();
  await reporter.goto(`/properties/${property.slug}`);
  await reporter
    .getByRole("button", { name: "Report this listing", exact: true })
    .first()
    .click();
  await reporter
    .getByLabel("Description", { exact: true })
    .fill(
      "The photographs appear to have been copied from a different property.",
    );
  await reporter.getByLabel("Email (optional)").fill("reporter@example.com");
  await reporter.getByLabel("Add evidence").setInputFiles({
    name: "evidence.jpg",
    mimeType: "image/jpeg",
    buffer: image,
  });
  const submitted = reporter.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/reports") && r.request().method() === "POST",
  );
  await reporter
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  const receipt = (await (await submitted).json()).data;
  await expect(
    reporter.getByText(receipt.reference, { exact: true }),
  ).toBeVisible();
  await expect(
    reporter.getByText("evidence.jpg · Uploaded", { exact: true }),
  ).toBeVisible();
  await staff.setViewportSize({ width: 390, height: 844 });
  await staff.goto("/staff/complaints");
  await staff.getByRole("link").filter({ hasText: receipt.reference }).click();
  await expect(
    staff.getByText("reporter@example.com", { exact: true }),
  ).toBeVisible();
  await expect(
    staff.getByRole("button", { name: "Open evidence 1 · image/jpeg" }),
  ).toBeVisible();
  await staff.getByLabel("Assigned team member").selectOption(actor.id);
  await staff.getByRole("button", { name: "Assign case", exact: true }).click();
  await staff
    .getByRole("button", { name: "start investigation", exact: true })
    .click();
  await staff
    .getByRole("button", { name: "Confirm start investigation", exact: true })
    .click();
  await expect(
    staff.getByRole("heading", { name: "Build a supported conclusion." }),
  ).toBeVisible();
  expect(
    await staff
      .getByLabel("Actions", { exact: true })
      .locator("option")
      .allTextContents(),
  ).not.toContain("landlord blocked");
  await expect(staff.locator(".mobile-launch")).toBeHidden();
  await staff
    .getByRole("heading", { name: "Build a supported conclusion." })
    .scrollIntoViewIfNeeded();
  await staff.screenshot({
    path: "/tmp/kofa-complaints-investigation.png",
    fullPage: true,
  });
  expect((await new AxeBuilder({ page: staff }).analyze()).violations).toEqual(
    [],
  );
  await staff.getByRole("button", { name: "place hold", exact: true }).click();
  await staff
    .getByLabel("Reason for action")
    .fill("Verifying a potential fraudulent listing.");
  await staff
    .getByRole("button", { name: "Confirm place hold", exact: true })
    .click();
  await expect(
    staff.getByRole("heading", { name: "Precautionary hold", exact: true }),
  ).toBeVisible();
  expect(
    (
      await reporter.request.get(`/api/v1/properties/${property.slug}`)
    ).status(),
  ).toBe(404);
  await staff
    .getByRole("button", { name: "release hold", exact: true })
    .click();
  await staff
    .getByLabel("Reason for action")
    .fill("Evidence checked; the temporary hold is no longer required.");
  await staff
    .getByRole("button", { name: "Confirm release hold", exact: true })
    .click();
  await expect(
    staff.getByRole("heading", { name: "Precautionary hold", exact: true }),
  ).toHaveCount(0);
  await staff
    .getByLabel("Findings", { exact: true })
    .fill("PRIVATE: reviewed source images and owner records.");
  await staff
    .getByLabel("Evidence reviewed", { exact: true })
    .fill("Photo comparison and verification record.");
  await staff
    .getByLabel("Public note (optional)")
    .fill("We have reviewed your concern.");
  await staff
    .getByRole("button", { name: "Save working record", exact: true })
    .click();
  await staff.getByRole("button", { name: "resolve", exact: true }).click();
  await staff
    .getByRole("button", { name: "Confirm resolve", exact: true })
    .click();
  await expect(
    staff.getByText("resolved", { exact: true }).first(),
  ).toBeVisible();
  const clientContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    client = await clientContext.newPage();
  await reviewLogin(client, "client");
  await client.goto("/account/complaint-form");
  await client
    .getByLabel("Description", { exact: true })
    .fill("Please help me understand the delay in arranging a visit.");
  const complaint = client.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/complaints") && r.request().method() === "POST",
  );
  await client
    .getByRole("button", { name: "Submit complaint", exact: true })
    .click();
  const own = (await (await complaint).json()).data;
  await client
    .getByRole("link", { name: "Track my complaint", exact: true })
    .click();
  await expect(client.getByText(own.reference, { exact: true })).toBeVisible();
  expect(
    (await client.request.get(`/api/v1/complaints/${receipt.id}`)).status(),
  ).toBe(404);
  await staff.goto(`/staff/complaint?id=${own.id}`);
  await staff.getByRole("button", { name: "dismiss", exact: true }).click();
  await staff
    .getByRole("button", { name: "Confirm dismiss", exact: true })
    .click();
  await expect(
    staff.getByText("dismissed", { exact: true }).first(),
  ).toBeVisible();
  await client.reload();
  await expect(client.getByText("dismissed", { exact: true })).toBeVisible();
  const clientOutput = await (
    await client.request.get(`/api/v1/complaints/${own.id}`)
  ).json();
  expect(JSON.stringify(clientOutput)).not.toMatch(
    /reporter|findings|evidence|upload_token|ip_hash/,
  );
  for (const width of [360, 768, 1280]) {
    await client.setViewportSize({ width, height: 844 });
    expect(
      await client.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page: client }).analyze()).violations).toEqual(
    [],
  );
  await client.screenshot({
    path: "/tmp/kofa-complaints-client.png",
    fullPage: true,
  });
  await clientContext.close();
  await publicContext.close();
});
