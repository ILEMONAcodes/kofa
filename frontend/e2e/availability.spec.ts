import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { reviewLogin } from "./review-helpers";

test("availability scan, staff reconfirmation, history and unavailable public browsing",async({page,browser})=>{
 test.setTimeout(120000);
 await reviewLogin(page,"staff");
 const property=JSON.parse(execFileSync(resolve("../backend/.venv/bin/python"),["-m","tests.seed_availability_e2e"],{cwd:resolve("../backend"),encoding:"utf8"}));
 await page.goto("/staff/overview");
 await page.getByRole("link",{name:"Review availability",exact:true}).click();
 await expect(page).toHaveURL(/availability-queue$/);
 await page.getByLabel("Search availability queue").fill(property.title);
 await page.getByRole("button",{name:"Search listings"}).click();
 const card=page.getByRole("region",{name:property.title});
 await expect(card).toBeVisible();
 for(const width of [360,1280]) {
  await page.setViewportSize({width,height:900});
  await expect(page.locator(".mobile-launch")).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:width===360?"/tmp/kofa-availability-mobile.png":"/tmp/kofa-availability-desktop.png",fullPage:true});
 }
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);

 await card.getByLabel("Confirmation note (optional)").fill("Owner confirmed available by phone.");
 await card.getByRole("button",{name:"Save confirmation"}).click();
 await expect(page.getByText("Availability confirmation saved.")).toBeVisible();
 await expect(page.getByText("No listings need reconfirmation.")).toBeVisible();
 await page.getByRole("link",{name:"View saved confirmation"}).click();
 await expect(page).toHaveURL(/availability-history/);
 await expect(page.getByRole("region",{name:"Confirmation history"}).getByText("Owner confirmed available by phone.")).toBeVisible();
 await page.goto(`/staff/availability?id=${property.id}`);
 await expect(page.getByRole("region",{name:"Confirmation history"}).getByText("Owner confirmed available by phone.")).toBeVisible();
 await page.getByLabel("Availability",{exact:true}).selectOption("let");
 await page.getByLabel("Confirmation note (optional)").fill("Owner confirmed this home has been let.");
 await page.getByRole("button",{name:"Confirm availability",exact:true}).click();
 await expect(page.getByRole("region",{name:"Confirmation history"}).getByText("Owner confirmed this home has been let.")).toBeVisible();
 const detail=await page.request.get(`/api/v1/properties/${property.slug}`);
 expect(detail.status()).toBe(200);
 expect((await detail.json()).data.availability_status).toBe("unavailable");
 expect(await detail.text()).not.toContain("Owner confirmed this home has been let.");
 const search=await page.request.get(`/api/v1/properties?q=${encodeURIComponent(property.title)}`);
 expect((await search.json()).data).toEqual([]);
 for(const width of [360,768,1280]){
  await page.setViewportSize({width,height:900});
  await expect(page.locator(".mobile-launch")).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.goto("/staff/availability-queue");
 await page.screenshot({path:"/tmp/kofa-availability-empty.png",fullPage:true});
 const context=await browser.newContext();
 const client=await context.newPage();
 await reviewLogin(client,"client");
 expect((await client.request.get("/api/v1/admin/availability-queue")).status()).toBe(403);
 expect((await client.request.get(`/api/v1/admin/properties/${property.id}/availability-history`)).status()).toBe(403);
 await context.close();
});
