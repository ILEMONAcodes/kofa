import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {reviewLogin} from "./review-helpers";

test("staff draft, admin publish, public Help and editable support hours",async({page,browser})=>{
 test.setTimeout(120000);
 await reviewLogin(page,"staff");
 await page.goto("/staff/edit-article");
 await page.getByLabel("Article title").fill("Preparing for your inspection");
 await page.getByLabel("Article topic").selectOption("inspections");
 await page.getByLabel("Article body").fill("Our team will confirm the inspection time. Bring your questions and review the listing before your visit.");
 await page.getByRole("button",{name:"Save draft",exact:true}).click();
 await expect(page).toHaveURL(/\/staff\/article\?id=/);
 await expect(page.getByText("Status: Draft",{exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Publish article",exact:true})).toHaveCount(0);
 const id=new URL(page.url()).searchParams.get("id");
 const anonymous=await browser.newContext();const publicPage=await anonymous.newPage();
 await publicPage.goto("/resources/help");
 await expect(publicPage.getByText("Preparing for your inspection",{exact:true})).toHaveCount(0);
 await reviewLogin(page,"admin");
 await page.goto(`/admin/article?id=${id}`);
 await page.getByRole("button",{name:"Publish article",exact:true}).click();
 await expect(page.getByText("Status: Published",{exact:true})).toBeVisible();
 await publicPage.reload();
 await publicPage.getByRole("link",{name:"Preparing for your inspection Inspections"}).click();
 await expect(publicPage.getByText("Our team will confirm the inspection time.",{exact:false})).toBeVisible();
 await page.goto("/admin/support-settings");
 await expect(page.getByLabel("Support phone")).toHaveValue("+2348145935403");
 await page.getByLabel("Support email").fill("support@example.com");
 await page.getByRole("button",{name:"Save support settings",exact:true}).click();
 await expect.poll(async()=> (await (await page.request.get("/api/v1/public-config")).json()).data.support.email).toBe("support@example.com");
 for(const width of [360,768,1280]){
  await publicPage.setViewportSize({width,height:900});
  await publicPage.goto("/resources/help");
  await expect(publicPage.getByRole("link",{name:"support@example.com",exact:true})).toBeVisible();
  await expect(publicPage.locator(".mobile-launch")).toBeHidden();
  expect(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page:publicPage}).analyze()).violations).toEqual([]);
  await publicPage.screenshot({path:`/tmp/kofa-help-${width}.png`,fullPage:true});
 }
 await page.goto(`/admin/article?id=${id}`);
 await page.getByRole("button",{name:"Unpublish article",exact:true}).click();
 await expect(page.getByText("Status: Draft",{exact:true})).toBeVisible();
 await publicPage.reload();
 await expect(publicPage.getByText("Preparing for your inspection",{exact:true})).toHaveCount(0);
 await anonymous.close();
});
