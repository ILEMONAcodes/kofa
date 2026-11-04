import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { reviewLogin } from "./review-helpers";

test("published homes drive responsive public search, pagination, details and photos; unpublishing hides them", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  await reviewLogin(page, "staff");
  const records: { id: string; slug: string; title: string }[] = JSON.parse(
    execFileSync(
      resolve("../backend/.venv/bin/python"),
      ["-m", "tests.seed_public_e2e"],
      { cwd: resolve("../backend"), encoding: "utf8" },
    ),
  );
  const csrf = (await page.context().cookies()).find(
    (c) => c.name === "csrf_token",
  )!.value;
  const headers = { Origin: "http://127.0.0.1:3100", "X-CSRF-Token": csrf };
  const photo = execFileSync(resolve("../backend/.venv/bin/python"), [
    "-c",
    "import sys,io; from PIL import Image; b=io.BytesIO(); Image.new('RGB',(160,120),'brown').save(b,'JPEG'); sys.stdout.buffer.write(b.getvalue())",
  ]);
  for (const record of records) {
    const upload = await page.request.post(
      `/api/v1/admin/properties/${record.id}/media`,
      {
        headers,
        multipart: {
          kind: "photo",
          file: {
            name: "courtyard.jpg",
            mimeType: "image/jpeg",
            buffer: photo,
          },
        },
      },
    );
    expect(upload.status(), await upload.text()).toBe(201);
    const data = (
      await (
        await page.request.get(`/api/v1/admin/properties/${record.id}`)
      ).json()
    ).data;
    const publish = await page.request.post(
      `/api/v1/admin/properties/${record.id}/transitions`,
      { headers, data: { action: "publish", version: data.version } },
    );
    expect(publish.status(), await publish.text()).toBe(200);
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const visitor = await context.newPage();
  const query =
    "listing_type=rent&q=Courtyard%20browser&page_size=6&sort=price";
  await visitor.goto(`/properties?${query}`);
  await expect(
    visitor.getByText("Page 1 of 3 · 13 properties", { exact: true }),
  ).toBeVisible();
  const desktop = visitor.locator(".search-property-grid");
  await expect(desktop.locator("article")).toHaveCount(6);
  await expect(desktop.locator(".property-card-link").first()).toHaveText(
    records[0].title,
  );
  await visitor.getByRole("link", { name: "Next", exact: true }).click();
  await expect(visitor).toHaveURL(/page=2/);
  await expect(
    visitor.getByText("Page 2 of 3 · 13 properties", { exact: true }),
  ).toBeVisible();
  await visitor.getByRole("link", { name: "Previous", exact: true }).click();
  await expect(
    visitor.getByText("Page 1 of 3 · 13 properties", { exact: true }),
  ).toBeVisible();
  await expect(desktop.locator(".property-card-link").first()).toHaveText(
    records[0].title,
  );
  await desktop.locator(".property-card-link").first().click();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(
    records[0].title,
  );
  await expect(
    visitor.getByText("Private exact browser address", { exact: true }),
  ).toHaveCount(0);
  const image = visitor.locator(".detail-gallery img").first();
  await expect
    .poll(() =>
      image.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
    )
    .toBe(true);
  await visitor.getByRole("button", { name: /Open photo 1/ }).click();
  await expect(visitor.getByRole("dialog")).toBeVisible();
  await visitor
    .getByRole("button", { name: "Back to property", exact: true })
    .click();
  await visitor
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Properties", exact: true })
    .click();
  await expect(visitor).toHaveURL(/q=Courtyard/);
  for (const width of [360, 768, 1280]) {
    await visitor.setViewportSize({ width, height: 900 });
    expect(
      await visitor
        .locator("body")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
    ).toBe(true);
  }
  await visitor.setViewportSize({ width: 390, height: 844 });
  await visitor
    .getByRole("button", { name: "Open filters", exact: true })
    .click();
  await visitor
    .getByRole("combobox", { name: "Property type", exact: true })
    .click();
  await visitor.getByRole("option", { name: "House", exact: true }).click();
  await visitor
    .getByRole("button", { name: "Show properties", exact: true })
    .click();
  await expect(visitor).toHaveURL(/property_type=house/);
  await expect(visitor.locator(".mobile-result-cards article")).toHaveCount(6);
  await expect(
    visitor.getByText("Page 1 of 1 · 6 properties", { exact: true }),
  ).toBeVisible();
  await visitor.goto("/properties?q=NotAMatchingHome");
  await expect(
    visitor.getByRole("heading", { name: "No properties found", exact: true }),
  ).toBeVisible();
  await visitor.goto("/properties?unknown=1");
  await expect(
    visitor.getByRole("heading", {
      name: "Unable to load properties",
      exact: true,
    }),
  ).toBeVisible();
  await visitor.goto("/properties?city=Abuja&city=Lagos");
  await expect(
    visitor.getByRole("heading", {
      name: "Unable to load properties",
      exact: true,
    }),
  ).toBeVisible();
  await visitor.goto("/");
  await expect(visitor.locator(".mobile-card-carousel article")).toHaveCount(
    12,
  );
  await visitor.goto(`/properties/${records[0].slug}`);
  const current = (
    await (
      await page.request.get(`/api/v1/admin/properties/${records[0].id}`)
    ).json()
  ).data;
  const unpublished = await page.request.post(
    `/api/v1/admin/properties/${records[0].id}/transitions`,
    {
      headers,
      data: {
        action: "unpublish",
        reason: "Withdrawn for test availability review.",
        version: current.version,
      },
    },
  );
  expect(unpublished.status()).toBe(200);
  const hidden = await visitor.goto(`/properties/${records[0].slug}`);
  expect(hidden?.status()).toBe(404);
  const media = (
    await (
      await page.request.get(`/api/v1/admin/properties/${records[0].id}`)
    ).json()
  ).data.media[0];
  expect(
    (await visitor.request.get(`/api/v1/property-media/${media.id}`)).status(),
  ).toBe(404);
  await visitor.goto(`/properties?${query}`);
  const axe = await new AxeBuilder({ page: visitor }).analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await visitor
    .locator(".mobile-result-cards article")
    .first()
    .scrollIntoViewIfNeeded();
  await visitor.screenshot({ path: "/tmp/kofa-public-mobile.png" });
  await visitor.setViewportSize({ width: 1280, height: 900 });
  await visitor.screenshot({ path: "/tmp/kofa-public-desktop.png" });
  await context.close();
});
