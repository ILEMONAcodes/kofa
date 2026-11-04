import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { reviewLogin } from "./review-helpers";

test("anonymous landlord resumes partial uploads and submits; staff verifies/publishes; visitors browse until unpublished", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    sessionStorage.setItem("kofa-launch-seen", "1"),
  );
  const title = "Courtyard submission from owner";
  const jpeg = execFileSync(resolve("../backend/.venv/bin/python"), [
    "-c",
    "import sys,io; from PIL import Image; b=io.BytesIO(); Image.new('RGB',(100,80),'brown').save(b,'JPEG'); sys.stdout.buffer.write(b.getvalue())",
  ]);
  const pdf = execFileSync(resolve("../backend/.venv/bin/python"), [
    "-c",
    "import sys,io; from pypdf import PdfWriter; b=io.BytesIO(); w=PdfWriter(); w.add_blank_page(width=100,height=100); w.write(b); sys.stdout.buffer.write(b.getvalue())",
  ]);
  const photo = (name: string) => ({
    name,
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  let creates = 0,
    successfulUploads = 0;
  page.on("response", (r) => {
    const path = new URL(r.url()).pathname;
    if (
      r.request().method() === "POST" &&
      path === "/api/v1/landlord-submissions"
    )
      creates++;
    if (r.status() === 201 && path.endsWith("/files")) successfulUploads++;
  });
  await page.goto("/landlord");
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Fictional Browser Owner");
  await page.getByLabel("Phone number", { exact: true }).fill("08012345678");
  await page
    .getByLabel("Email (optional)", { exact: true })
    .fill("fictional-owner@example.com");
  await page
    .getByLabel("Relationship to property", { exact: true })
    .selectOption("owner");
  await page
    .getByRole("button", { name: "Continue to property", exact: true })
    .click();
  await page.getByLabel("Listing title", { exact: true }).fill(title);
  await page
    .getByLabel("Neighbourhood", { exact: true })
    .selectOption("Wuse 2");
  await page
    .getByLabel("Exact address (private)", { exact: true })
    .fill("12 Private Fictional Street");
  await page
    .getByRole("textbox", { name: "Property description", exact: true })
    .fill(
      "A bright courtyard apartment with comfortable living spaces and parking.",
    );
  await page
    .getByRole("button", { name: "Continue to pricing", exact: true })
    .click();
  await page.getByLabel("Price in naira", { exact: true }).fill("3,500,000");
  await page
    .getByRole("button", { name: "Continue to features", exact: true })
    .click();
  await page.getByLabel("Bedrooms", { exact: true }).selectOption("3");
  await page.getByLabel("Bathrooms", { exact: true }).selectOption("2");
  await page.getByRole("combobox", { name: "Amenities", exact: true }).click();
  await page.getByRole("option", { name: "Parking", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue to photos", exact: true })
    .click();
  await page
    .getByLabel("Select property photos", { exact: true })
    .setInputFiles(
      Array.from({ length: 5 }, (_, i) => photo(`room-${i + 1}.jpg`)),
    );
  await page
    .getByLabel("Select private ownership evidence", { exact: true })
    .setInputFiles({
      name: "broken-proof.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a PDF"),
    });
  await page
    .getByRole("button", { name: "Review my listing", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "I confirm I am the owner or an authorised representative and the listing information is accurate.",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "I agree to the Terms and Privacy Policy for this submission.",
      exact: true,
    })
    .check();
  const create = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/api/v1/landlord-submissions",
  );
  const rejected = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname.endsWith("/files") &&
      r.status() >= 400,
  );
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  const draft = (await (await create).json()).data;
  await rejected;
  await expect(
    page.getByRole("button", { name: "Submit for review", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  expect(creates).toBe(1);
  expect(successfulUploads).toBe(5);
  await page
    .getByRole("button", { name: "Edit photos and evidence", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Manage photos, video & evidence",
      exact: true,
    })
    .click();
  const deleted = page.waitForResponse(
    (r) =>
      r.request().method() === "DELETE" &&
      new URL(r.url()).pathname.includes(
        `/landlord-submissions/${draft.id}/files/`,
      ),
  );
  await page
    .getByRole("button", { name: "Remove room-1.jpg", exact: true })
    .click();
  expect((await deleted).status()).toBe(204);
  await expect(
    page.getByRole("button", { name: "Remove room-1.jpg", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remove broken-proof.pdf", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByLabel("Select property photos", { exact: true })
    .setInputFiles(photo("replacement.jpg"));
  await page
    .getByLabel("Select private ownership evidence", { exact: true })
    .setInputFiles({
      name: "ownership-proof.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });
  await page
    .getByRole("button", { name: "Review my listing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Your property is with our team.",
      exact: true,
    }),
  ).toBeVisible();
  const reference = await page.getByText(/^SUB-\d{4}-\d+$/).textContent();
  expect(reference).toBeTruthy();
  expect(creates).toBe(1);
  expect(successfulUploads).toBe(7);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain(draft.upload_token);
  await page.screenshot({ path: "/tmp/kofa-landlord-receipt.png" });
  const csrf = (await page.context().cookies()).find(
    (c) => c.name === "csrf_token",
  )!.value;
  const repeat = await page.request.post(
    `/api/v1/landlord-submissions/${draft.id}/submit`,
    {
      headers: {
        Origin: "http://127.0.0.1:3100",
        "X-CSRF-Token": csrf,
        "X-Upload-Token": draft.upload_token,
      },
    },
  );
  expect(repeat.status()).toBe(200);
  expect((await repeat.json()).data.reference).toBe(reference);
  const staffContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const staff = await staffContext.newPage();
  await reviewLogin(staff, "staff");
  await staff.goto("/staff/properties");
  await staff.getByLabel("Search properties", { exact: true }).fill(title);
  await staff.getByRole("button", { name: "Search", exact: true }).click();
  await staff.getByRole("link").filter({ hasText: title }).first().click();
  await expect(staff.getByRole("heading", { level: 1 })).toHaveText(title);
  let record = (
    await (
      await staff.request.get(`/api/v1/admin/properties/${draft.id}`)
    ).json()
  ).data;
  expect(record.media).toHaveLength(5);
  expect(record.documents).toHaveLength(1);
  expect(record.landlord.phone).toBe("+2348012345678");
  expect(
    (await page.request.get(record.documents[0].signed_url)).status(),
  ).toBe(401);
  async function transition(p: Page, action: string, reason?: string) {
    await p.getByLabel("Listing action", { exact: true }).selectOption(action);
    await p
      .getByRole("button", { name: "Continue with action", exact: true })
      .click();
    if (reason)
      await p
        .getByRole("dialog")
        .getByLabel("Reason", { exact: true })
        .fill(reason);
    await p
      .getByRole("dialog")
      .getByRole("button", {
        name: `Confirm ${action.replaceAll("_", " ")}`,
        exact: true,
      })
      .click();
    await expect(p.locator(".staff-live").getByRole("status")).toContainText(
      "completed.",
    );
  }
  await transition(staff, "start_review");
  await staff
    .getByLabel("Verification scope", { exact: true })
    .fill(
      "Identity, ownership, location, price and property features checked.",
    );
  for (const code of [
    "Identity",
    "Ownership docs",
    "Location",
    "Price",
    "Features",
  ])
    await staff
      .getByLabel(`${code} result`, { exact: true })
      .selectOption("pass");
  await staff
    .getByLabel("Ownership docs evidence", { exact: true })
    .selectOption(record.documents[0].id);
  await staff
    .getByRole("button", { name: "Save verification checklist", exact: true })
    .click();
  await expect(
    staff.getByText(
      "Verification checklist saved. Complete it when the review is finished.",
      { exact: true },
    ),
  ).toBeVisible();
  await staff
    .getByRole("button", {
      name: "Complete verification as passed",
      exact: true,
    })
    .click();
  await expect(
    staff.getByText("Verification passed.", { exact: true }),
  ).toBeVisible();
  await staff
    .getByLabel("Approval date and time (WAT)", { exact: true })
    .fill(new Date(Date.now() - 120000 + 3600000).toISOString().slice(0, 16));
  await staff
    .getByLabel(
      "The landlord approved the current advertised price and description.",
      { exact: true },
    )
    .check();
  await staff
    .getByRole("button", { name: "Record landlord approval", exact: true })
    .click();
  await expect(
    staff.getByText("Landlord approval recorded.", { exact: true }),
  ).toBeVisible();
  await transition(staff, "approve");
  await transition(staff, "publish");
  record = (
    await (
      await staff.request.get(`/api/v1/admin/properties/${draft.id}`)
    ).json()
  ).data;
  await page.goto(`/properties?q=${encodeURIComponent(title)}`);
  await expect(page.locator(".mobile-result-cards article")).toHaveCount(1);
  await page.locator(".mobile-result-cards .property-card-link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const image = page.locator(".detail-gallery img").first();
  await expect
    .poll(() =>
      image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
    )
    .toBe(true);
  const publicData = await (
    await page.request.get(`/api/v1/properties/${record.slug}`)
  ).text();
  for (const secret of [
    "Fictional Browser Owner",
    "08012345678",
    "+2348012345678",
    "fictional-owner@example.com",
    "12 Private Fictional Street",
    "ownership-proof.pdf",
    "documents",
    "landlord",
  ])
    expect(publicData).not.toContain(secret);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator("body")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
    ).toBe(true);
  }
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.screenshot({ path: "/tmp/kofa-landlord-published-desktop.png" });
  await transition(staff, "unpublish", "Owner requested availability review.");
  expect((await page.goto(`/properties/${record.slug}`))?.status()).toBe(404);
  expect(
    (
      await page.request.get(`/api/v1/property-media/${record.media[0].id}`)
    ).status(),
  ).toBe(404);
  await staffContext.close();
});
