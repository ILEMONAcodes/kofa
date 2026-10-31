import {test,expect} from "@playwright/test";
import {testAccount,reviewLogin} from "./review-helpers";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
const origin="http://127.0.0.1:3100";
const accountBar=(page:import("@playwright/test").Page)=>page.getByRole("complementary",{name:"Account access"});
async function login(page:import("@playwright/test").Page,email:string,password:string) {
 await page.goto("/login");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Log in",exact:true}).click();
}
async function signOut(page:import("@playwright/test").Page) {await accountBar(page).getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/\/$/);}
function outboxLink(email:string,template:string) {return execFileSync(resolve("../backend/.venv/bin/python"),["-m","tests.e2e_token",email,template],{cwd:resolve("../backend"),encoding:"utf8"}).trim();}
test.beforeEach(async({page})=>{await page.addInitScript(()=>sessionStorage.setItem("kofa-launch-seen","1"));});
test("one login assigns database roles, persists through reload and revokes logout",async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:390,height:844});
 for(const role of ["admin","staff","client"] as const) {
  const account=await testAccount(page,role);await login(page,account.email,account.password);
  await expect(page).toHaveURL(new RegExp(role==="admin"?"/admin/administration$":role==="staff"?"/staff/overview$":"/account/overview$"));
  await page.reload();await expect(accountBar(page).getByRole("button",{name:"Sign out",exact:true})).toBeVisible();
  const cookies=await page.context().cookies(origin+"/api/v1/auth/me");
  const access=cookies.find(c=>c.name==="access_token")!;expect(access.httpOnly).toBe(true);expect(access.sameSite).toBe("Lax");
  expect(await page.evaluate(()=>document.cookie)).not.toMatch(/access_token|refresh_token/);
  const before=await page.request.get("/api/v1/auth/me");expect((await before.json()).data.role).toBe(role);
  await signOut(page);expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
  const stolen=await page.request.get("/api/v1/auth/me",{headers:{Cookie:`access_token=${access.value}`}});expect(stolen.status()).toBe(401);
 }
});
test("registration requires eight characters and records a client without role selection",async({page})=>{
 await testAccount(page,"client");
 await page.goto("/register");await page.getByLabel("Full name",{exact:true}).fill("New Example Client");await page.getByLabel("Email",{exact:true}).fill("registration-e2e@example.com");await page.getByLabel("Phone number",{exact:true}).fill("+2348012345678");
 await page.getByLabel("Password",{exact:true}).fill("Short7!");await page.getByLabel("Confirm password",{exact:true}).fill("Short7!");await page.getByLabel("I agree to the Terms and Privacy Policy.",{exact:true}).check();
 await page.getByRole("button",{name:"Create account",exact:true}).click();await expect(page).toHaveURL(/\/register$/);
 await page.getByLabel("Password",{exact:true}).fill("Newp8!xy");await page.getByLabel("Confirm password",{exact:true}).fill("Newp8!xy");await page.getByRole("button",{name:"Create account",exact:true}).click();await expect(page).toHaveURL(/\/account\/overview$/);
 const me=await page.request.get("/api/v1/auth/me");expect((await me.json()).data.role).toBe("client");
 expect((await page.request.get("/api/v1/admin/users")).status()).toBe(403);
 await page.addInitScript(()=>sessionStorage.setItem("kofa-local-access-v1","admin"));await page.goto("/admin/users");await expect(page.getByRole("heading",{name:"This doorway leads elsewhere."})).toBeVisible();
 const csrf=(await page.context().cookies()).find(c=>c.name==="csrf_token")!.value;
 const attack=await page.request.post("/api/v1/auth/register",{headers:{Origin:origin,"X-CSRF-Token":csrf},data:{full_name:"Attack Example",email:"attack@example.com",phone:"+2348012345678",password:"Newp8!xy",role:"admin",accepted_policies:[]}});expect(attack.status()).toBe(422);
});
test("admin creates staff in the database and deactivation blocks their next sign-in",async({page})=>{
 test.setTimeout(90000);const admin=await testAccount(page,"admin");await reviewLogin(page,"admin");await page.goto("/admin/users");
 await page.getByLabel("Full name",{exact:true}).fill("New Team Member");await page.getByLabel("Email",{exact:true}).fill("new-team-member-e2e@example.com");await page.getByLabel("Temporary password (optional)",{exact:true}).fill("Staffp8!");await page.getByRole("button",{name:"Add team member",exact:true}).click();await expect(page.getByRole("heading",{name:"New Team Member",exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole("heading",{name:"New Team Member",exact:true})).toBeVisible();await signOut(page);
 await login(page,"new-team-member-e2e@example.com","Staffp8!");await expect(page).toHaveURL(/\/staff\/overview$/);expect((await page.request.get("/api/v1/admin/users")).status()).toBe(403);await signOut(page);
 await login(page,admin.email,admin.password);await expect(page).toHaveURL(/\/admin\/administration$/);await page.goto("/admin/users");await page.getByRole("button",{name:"Deactivate New Team Member",exact:true}).click();await expect(page.getByRole("button",{name:"Activate New Team Member",exact:true})).toBeVisible();await signOut(page);
 await login(page,"new-team-member-e2e@example.com","Staffp8!");await expect(page.locator(".auth-form [role=alert]")).toContainText("Invalid email or password.");
});
test("an expired access cookie silently restores the session and selected property",async({page})=>{
 await reviewLogin(page,"client");const previous=(await page.context().cookies(origin+"/api/v1/auth/me")).find(c=>c.name==="access_token")!.value;
 await page.context().clearCookies({name:"access_token"});await page.goto("/account/inquiry?property=2-bedroom-flat-jabi");await expect(page).toHaveURL(/\/account\/inquiry\?property=2-bedroom-flat-jabi/);await expect(page.getByRole("heading",{name:"2-bedroom flat, Jabi",exact:true})).toBeVisible();
 const next=(await page.context().cookies(origin+"/api/v1/auth/me")).find(c=>c.name==="access_token")!.value;expect(next).not.toBe(previous);
});
test("password reset and email verification use actual single-use outbox links",async({page})=>{
 test.setTimeout(90000);const account=await testAccount(page,"client");await login(page,account.email,account.password);await expect(page).toHaveURL(/\/account\/overview$/);
 const token=(await page.context().cookies()).find(c=>c.name==="csrf_token")!.value;
 expect((await page.request.post("/api/v1/auth/email-verification/request",{headers:{Origin:origin,"X-CSRF-Token":token}})).status()).toBe(202);
 await page.goto(outboxLink(account.email,"verification"));await page.locator(".auth-actions").getByRole("button").first().click();await expect(page).toHaveURL(/\/verified\?/);
 await page.goto("/forgot-password");await page.getByLabel("Email",{exact:true}).fill(account.email);await page.getByRole("button",{name:"Send reset link",exact:true}).click();await expect(page).toHaveURL(/\/reset-link-sent\?/);
 await page.goto(outboxLink(account.email,"reset"));await page.getByLabel("New password",{exact:true}).fill("Changed8!");await page.getByLabel("Confirm new password",{exact:true}).fill("Changed8!");await page.getByRole("button",{name:"Save new password",exact:true}).click();await expect(page).toHaveURL(/\/password-updated\?/);
 await login(page,account.email,"Changed8!");await expect(page).toHaveURL(/\/account\/overview$/);
});
