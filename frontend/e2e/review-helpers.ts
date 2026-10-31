import type {Page} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
type Role="client"|"staff"|"admin";
type Fixture={email:string;password:string;role:Role};
const identities=new WeakMap<Page,{ip:string;roles:Partial<Record<Role,Fixture>>}>();
let count=0;
export async function testAccount(page:Page,role:Role):Promise<Fixture> {
 let state=identities.get(page);
 if(!state) {
  const worker=Number(process.env.TEST_WORKER_INDEX ?? 0)%240;
  state={ip:`198.18.${worker}.${++count%240+1}`,roles:{}};identities.set(page,state);
  await page.setExtraHTTPHeaders({"x-forwarded-for":state.ip});
 }
 let account=state.roles[role];
 if(!account) {
  account={email:`kofa-e2e-${state.ip.replaceAll(".","-")}-${role}@example.com`,password:"Browserpass8!",role};
  execFileSync(resolve("../backend/.venv/bin/python"),["-m","tests.seed_e2e",account.email,role],{cwd:resolve("../backend"),stdio:"pipe"});
  state.roles[role]=account;
 }
 return account;
}
export async function reviewLogin(page:Page,role:Role="client") {
 const account=await testAccount(page,role);
 const response=await page.request.get("/api/v1/auth/me");
 if(response.ok() && (await response.json()).data?.role===role) return;
 await page.request.get("/api/v1/auth/csrf");
 const csrf=(await page.context().cookies()).find(c=>c.name==="csrf_token")!.value;
 const login=await page.request.post("/api/v1/auth/login",{headers:{Origin:"http://127.0.0.1:3100","X-CSRF-Token":csrf,"x-forwarded-for":identities.get(page)!.ip},data:{email:account.email,password:account.password}});
 if(!login.ok()) throw new Error(`Database fixture sign-in failed: ${login.status()}`);
}
