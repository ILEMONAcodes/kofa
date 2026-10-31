import type { Page } from "@playwright/test";
// Fake test fixtures, injected into the local Playwright server only.
export const testSecret = "kofa-e2e-only-signing-secret-at-least-32-characters";
export const testAccounts = [
 {email:"admin@kofa.test",password:"E2e-admin-only-392!",role:"admin"},
 {email:"staff@kofa.test",password:"E2e-staff-only-483!",role:"staff"},
];
// Local Next trusts this header; production hosts must sanitize it. Each fixture
// represents a distinct reviewer rather than sharing one rate bucket for 98 tests.
const fixtureIPs = new WeakMap<Page,string>();
let fixtureCounter = 0;
export async function reviewLogin(page:Page, role:"client"|"staff"|"admin"="client") {
 const session=await page.request.get("/api/review-auth");
 if(session.ok() && (await session.json()).data?.role===role) return;
 const account=testAccounts.find(a=>a.role===role) ?? {email:"client@example.com",password:"test12"};
 let ip=fixtureIPs.get(page);
 if(!ip) {ip=`198.18.${Number(process.env.TEST_WORKER_INDEX ?? 0) % 250}.${++fixtureCounter % 250 + 1}`;fixtureIPs.set(page,ip);}
 const response=await page.request.post("/api/review-auth",{headers:{Origin:"http://127.0.0.1:3100","x-forwarded-for":ip},data:{...account,role:undefined,intent:"login"}});
 if(!response.ok()) throw new Error(`Review fixture sign-in failed: ${response.status()}`);
}
