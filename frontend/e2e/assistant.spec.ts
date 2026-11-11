import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
import {testAccount,reviewLogin} from "./review-helpers";

test("grounded assistant, human handoff, staff review and admin usage controls",async({page,browser})=>{
 test.setTimeout(150000);
 execFileSync(resolve("../backend/.venv/bin/python"),["-m","tests.seed_assistant_e2e"],{cwd:resolve("../backend"),stdio:"pipe"});
 const client=await testAccount(page,"client");
 await page.goto("/resources/help");
 await page.getByRole("button",{name:"Ask Kof’a",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Ask Kof’a"});
 await dialog.getByLabel("Your question").fill("How should I prepare for an inspection?");
 await dialog.getByRole("button",{name:"Send question",exact:true}).click();
 await expect(dialog.getByText("Before an inspection, review the property listing and prepare your questions.",{exact:false})).toBeVisible();
 await expect(dialog.getByRole("link",{name:"Source: Preparing for an inspection"})).toBeVisible();
 for(const width of [360,768,1280]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:`/tmp/kofa-assistant-${width}.png`,fullPage:true});
 }
 await dialog.getByLabel("Your question").fill("How do I pay a service fee?");
 await dialog.getByRole("button",{name:"Send question",exact:true}).click();
 await expect(dialog.getByRole("region",{name:"Contact the team"})).toBeVisible();
 await expect(dialog.getByRole("link",{name:"Call +2348145935403"})).toBeVisible();
 await dialog.getByRole("link",{name:"Sign in to message our team"}).click();
 await expect(page).toHaveURL(/\/login/);
 await page.getByLabel("Email",{exact:true}).fill(client.email);
 await page.getByLabel("Password",{exact:true}).fill(client.password);
 await page.getByRole("button",{name:"Log in",exact:true}).click();
 await expect(page).not.toHaveURL(/\/login/);
 await page.getByRole("button",{name:"Ask Kof’a",exact:true}).click();
 await dialog.getByRole("button",{name:"Send conversation to our team",exact:true}).click();
 await expect(dialog.getByRole("link",{name:"Open your inquiry",exact:true})).toBeVisible();
 const href=await dialog.getByRole("link",{name:"Open your inquiry",exact:true}).getAttribute("href");
 const inquiry=new URL(href!,"http://localhost").searchParams.get("id");
 const team=await browser.newContext();const staff=await team.newPage();
 await reviewLogin(staff,"staff");await staff.goto("/staff/assistant");
 await staff.getByLabel("Review flag").selectOption("true");
 await staff.getByRole("link",{name:/Handed off/}).first().click();
 await expect(staff.getByText("How do I pay a service fee?",{exact:true})).toBeVisible();
 await staff.getByLabel("Private review note").fill("Reviewed and handed over to our team.");
 await staff.getByRole("button",{name:"Save review",exact:true}).click();
 await expect(staff.getByRole("status").filter({hasText:"Review saved."})).toHaveText("Review saved.");
 const notes=await staff.request.get(`/api/v1/admin/inquiries/${inquiry}/notes`);
 expect(notes.ok()).toBe(true);expect(await notes.text()).toContain("Assistant conversation (redacted)");
 await reviewLogin(staff,"admin");await staff.goto("/admin/assistant-usage");
 await expect(staff.getByText("Model requests",{exact:true})).toBeVisible();
 const usage=await staff.request.get("/api/v1/admin/assistant/usage");
 expect((await usage.json()).data.requests).toBe(1); // Out-of-scope question never calls the model.
 await staff.getByLabel("Daily token budget",{exact:true}).fill("0");
 await staff.getByRole("button",{name:"Save assistant controls",exact:true}).click();
 await expect(staff.getByRole("status").filter({hasText:"Assistant controls saved."})).toHaveText("Assistant controls saved.");
 await expect.poll(async()=> (await(await staff.request.get("/api/v1/public-config")).json()).data.assistant.enabled).toBe(false);
 await team.close();
});
