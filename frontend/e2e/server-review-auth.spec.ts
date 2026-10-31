import {test,expect} from "@playwright/test";
import {testAccounts,reviewLogin} from "./review-helpers";
const origin="http://127.0.0.1:3100";
test.beforeEach(async({page})=>{await page.addInitScript(()=>sessionStorage.setItem("kofa-launch-seen","1"));});
test("the same login routes each private account to its assigned workspace on mobile",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const account of [...testAccounts,{email:"client@example.com",password:"test12",role:"client"}]) {
  await page.goto("/login");
  await expect(page.getByLabel("Workspace role")).toHaveCount(0);
  await expect(page.getByRole("link",{name:/Staff & admin|Staff sign in/})).toHaveCount(0);
  await page.getByLabel("Email",{exact:true}).fill(account.email);
  await page.getByLabel("Password",{exact:true}).fill(account.password);
  await page.getByRole("button",{name:"Log in",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(account.role==="admin"?"/admin/administration$":account.role==="staff"?"/staff/overview$":"/account/overview$"));
  await page.reload();await expect(page.getByRole("complementary",{name:"Review access"}).getByRole("button",{name:"Sign out",exact:true})).toBeVisible();
  const cookie=(await page.context().cookies()).find(c=>c.name==="kofa_review_session")!;
  expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe("Lax");
  expect(await page.evaluate(()=>document.cookie)).not.toContain("kofa_review_session");
  await page.getByRole("complementary",{name:"Review access"}).getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin/users");await expect(page).toHaveURL(/\/login\?/);
 }
});
test("server blocks forged roles, tampered cookies, cross-role URLs and self-promotion",async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem("kofa-local-access-v1","admin"));
 const signedOut=await page.request.get("/admin/users",{maxRedirects:0});
 expect([200,307]).toContain(signedOut.status());
 if(signedOut.status()===200) expect(await signedOut.text()).toContain("NEXT_REDIRECT");
 await page.goto("/admin/users"); await expect(page).toHaveURL(/\/login\?/);
 await page.context().addCookies([{name:"kofa_review_session",value:"forged.admin",url:origin}]);
 const forged=await page.request.get("/staff/overview",{maxRedirects:0});
 expect([200,307]).toContain(forged.status());
 if(forged.status()===200) expect(await forged.text()).toContain("NEXT_REDIRECT");
 const request=page.request;
 const body={email:testAccounts[0].email,password:testAccounts[0].password,intent:"login"};
 expect((await request.post("/api/review-auth",{data:body})).status()).toBe(403);
 expect((await request.post("/api/review-auth",{headers:{Origin:"https://evil.test"},data:body})).status()).toBe(403);
 expect((await request.post("/api/review-auth",{headers:{Origin:origin},data:{...body,role:"admin"}})).status()).toBe(400);
 expect((await request.post("/api/review-auth",{headers:{Origin:origin},data:{...body,password:"wrong-password"}})).status()).toBe(401);
 expect((await request.post("/api/review-auth",{headers:{Origin:origin},data:{...body,intent:"register"}})).status()).toBe(401);
 await reviewLogin(page,"client");
 for(const route of ["/staff/overview","/admin/users","/admin/administration","/review/staff-review","/verification/staff-verification","/responsive-preview/overview","/resources/conflict"]){
  const response=await request.get(route);const html=await response.text();expect(html,route).toContain("This doorway leads elsewhere.");expect(html).not.toContain(testAccounts[0].email);
 }
 await reviewLogin(page,"staff");expect(await (await request.get("/admin/users")).text()).toContain("This doorway leads elsewhere.");
 await reviewLogin(page,"admin");const response=await request.get("/admin/users");expect(response.status()).toBe(200);expect(await response.text()).not.toContain(testAccounts[0].password);
});

test("HTTPS sessions use Secure cookies and oversized requests are rejected",async({request})=>{
 const response=await request.post("/api/review-auth",{headers:{Origin:"https://127.0.0.1:3100"},data:{email:testAccounts[0].email,password:testAccounts[0].password,intent:"login"}});
 expect(response.status()).toBe(200);
 expect(response.headers()["set-cookie"]).toMatch(/; Secure/i);
 expect(response.headers()["cache-control"]).toContain("no-store");
 const oversized=await request.post("/api/review-auth",{headers:{Origin:origin},data:{email:"x".repeat(3000),password:"test12",intent:"login"}});
 expect(oversized.status()).toBe(400);
});

test("repeated invalid sign-in attempts are rate limited",async({request})=>{
 for(let attempt=0;attempt<101;attempt++) {
  const response=await request.post("/api/review-auth",{headers:{Origin:origin,"x-forwarded-for":"198.19.255.254"},data:{email:"invalid"}});
  expect(response.status()).toBe(attempt<100 ? 400 : 429);
 }
});
