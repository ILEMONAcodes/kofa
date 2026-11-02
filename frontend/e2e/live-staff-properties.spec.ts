import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { reviewLogin } from "./review-helpers";

test("landlord submission reaches live staff queue, editing, assignment, availability and private media", async ({
  page,
}) => {
  test.setTimeout(120000);
  await reviewLogin(page, "staff");
  const csrf = (await page.context().cookies()).find(
    (c) => c.name === "csrf_token",
  )!.value;
  const headers = { Origin: "http://127.0.0.1:3100", "X-CSRF-Token": csrf };
  const options = (
    await (await page.request.get("/api/v1/admin/property-options")).json()
  ).data;
  const created = await page.request.post("/api/v1/landlord-submissions", {
    headers,
    data: {
      landlord: {
        full_name: "Browser Fictional Owner",
        phone: "08012345678",
        email: "fictional-owner@example.com",
        relationship: "owner",
      },
      property: {
        title: "Browser courtyard apartment",
        description:
          "A fictional apartment created only for the local browser test.",
        listing_type: "rent",
        property_type: "apartment",
        area_id: options.areas[0].id,
        address_line: "12 Fictional Court",
        price: { amount: 350000000, currency: "NGN", period: "year" },
        bedrooms: 3,
        bathrooms: 2,
        furnishing: "unfurnished",
        amenity_codes: ["parking"],
      },
      accepted_policies: [
        { type: "terms", version: "draft-v1" },
        { type: "privacy", version: "draft-v1" },
      ],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const draft = (await created.json()).data;
  const jpeg = execFileSync(resolve("../backend/.venv/bin/python"), [
    "-c",
    "import sys,io; from PIL import Image; b=io.BytesIO(); Image.new('RGB',(80,60),'brown').save(b,'JPEG'); sys.stdout.buffer.write(b.getvalue())",
  ]);
  const pdf = execFileSync(resolve("../backend/.venv/bin/python"), [
    "-c",
    "import sys,io; from pypdf import PdfWriter; b=io.BytesIO(); w=PdfWriter(); w.add_blank_page(width=100,height=100); w.write(b); sys.stdout.buffer.write(b.getvalue())",
  ]);
  for (let i = 0; i < 6; i++) {
    const response = await page.request.post(
      `/api/v1/landlord-submissions/${draft.id}/files`,
      {
        headers: { ...headers, "X-Upload-Token": draft.upload_token },
        multipart: {
          kind: i === 5 ? "ownership_proof" : "photo",
          file: {
            name: i === 5 ? "proof.pdf" : "room.jpg",
            mimeType: i === 5 ? "application/pdf" : "image/jpeg",
            buffer: i === 5 ? pdf : jpeg,
          },
        },
      },
    );
    expect(response.status(), await response.text()).toBe(201);
  }
  const submitted = await page.request.post(
    `/api/v1/landlord-submissions/${draft.id}/submit`,
    { headers: { ...headers, "X-Upload-Token": draft.upload_token } },
  );
  expect(submitted.status(), await submitted.text()).toBe(200);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/staff/properties");
  await page.getByLabel("Search properties").fill("Browser courtyard");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: "Browser courtyard apartment" }),
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`id=${draft.id}`));
  await expect(
    page.getByText("12 Fictional Court", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit listing", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Updated courtyard apartment");
  // Another reviewer changes this aggregate after the editor was opened.
  const before = (
    await (
      await page.request.get(`/api/v1/admin/properties/${draft.id}`)
    ).json()
  ).data;
  const concurrent = await page.request.patch(
    `/api/v1/admin/properties/${draft.id}/availability`,
    {
      headers,
      data: { availability_status: "available", version: before.version },
    },
  );
  expect(concurrent.status()).toBe(200);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".staff-live").getByRole("alert")).toContainText("Reload the record");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Updated courtyard apartment",
  );
  await page
    .getByRole("button", { name: "Reload record", exact: true })
    .click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Browser courtyard apartment",
  );
  await page
    .getByLabel("Title", { exact: true })
    .fill("Updated courtyard apartment");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Changes saved" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Updated courtyard apartment",
  );
  await page
    .getByRole("link", { name: "Property details", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Assign reviewer", exact: true })
    .click();
  await page
    .getByLabel("Reviewer", { exact: true })
    .selectOption(options.staff[0].id);
  await page
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(
    page.getByText("Reviewer assignment saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Property details", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Confirm availability", exact: true })
    .click();
  await page
    .getByLabel("Availability", { exact: true })
    .selectOption("under_offer");
  await page
    .getByRole("button", { name: "Confirm availability", exact: true })
    .click();
  await expect(
    page.getByText("Availability confirmed.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Property details", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Media and evidence", exact: true })
    .click();
  await page.getByLabel("Choose file", { exact: true }).setInputFiles({
    name: "new-room.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(page.getByText("File uploaded.", { exact: true })).toBeVisible();
  await expect(page.locator(".live-staff-panel img")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Use as cover", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Cover photo updated.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove photo", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Confirm removal", exact: true })
    .click();
  await expect(page.getByText("Media removed.", { exact: true })).toBeVisible();
  await expect(page.locator(".live-staff-panel img")).toHaveCount(5);
  const evidence = page.getByRole("link", {
    name: "Open ownership proof",
    exact: true,
  });
  const privateUrl = await evidence.getAttribute("href");
  expect(privateUrl).toContain("token=");
  expect((await page.request.get(privateUrl!)).status()).toBe(200);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: `/tmp/kofa-live-staff-media-${width}.png` });
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
  const record = (
    await (
      await page.request.get(`/api/v1/admin/properties/${draft.id}`)
    ).json()
  ).data;
  expect(record.title).toBe("Updated courtyard apartment");
  expect(record.availability_status).toBe("under_offer");
  expect(record.assigned_staff.id).toBe(options.staff[0].id);
  await page.goto(`/staff/landlord?id=${record.landlord.id}`);
  await expect(
    page.getByRole("heading", { name: "Browser Fictional Owner", exact: true }),
  ).toBeVisible();
  await reviewLogin(page, "client");
  expect((await page.request.get(privateUrl!)).status()).toBe(403);
  await page.goto(`/staff/property?id=${draft.id}`);
  await expect(page.locator(".staff-live")).toHaveCount(0);
});
