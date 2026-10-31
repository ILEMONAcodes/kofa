import { describe,it,expect } from "vitest";
import { authenticateReview,issueReviewSession,verifyReviewSession,reviewConfig,REVIEW_TTL } from "./core";
const secret="unit-only-secret-with-at-least-32-characters";
const accounts=[{email:"admin@kofa.test",password:"unit-admin-password",role:"admin"},{email:"staff@kofa.test",password:"unit-staff-password",role:"staff"}];
const config=reviewConfig(secret,JSON.stringify(accounts))!;
describe("server review identities",()=>{
 it("fails closed on missing/invalid configuration",()=>{
  for(const source of [undefined,"bad","[]",JSON.stringify([accounts[1]]),JSON.stringify([...accounts,accounts[0]]),JSON.stringify([{...accounts[0],password:"short"}])]) expect(reviewConfig(secret,source)).toBeNull();
  expect(reviewConfig("short",JSON.stringify(accounts))).toBeNull();
 });
 it("assigns privileged roles only for matching private credentials",async()=>{
  expect(await authenticateReview(config,"admin@kofa.test","wrong-password","login")).toBeNull();
  expect(await authenticateReview(config,"admin@kofa.test",accounts[0].password,"register")).toBeNull();
  for(const a of accounts) {const identity=await authenticateReview(config,a.email.toUpperCase(),a.password,"login");expect(identity?.role).toBe(a.role);expect(verifyReviewSession(config,issueReviewSession(config,identity!))).toBe(a.role);}
 });
 it("public walkthrough identities are clients only",async()=>{
  const identity=await authenticateReview(config,"example@example.com","test12","register");
  expect(identity?.role).toBe("client");expect(verifyReviewSession(config,issueReviewSession(config,identity!))).toBe("client");
 });
 it("rejects tampering, expiry, rotation, removed accounts and malformed tokens",async()=>{
  const identity=(await authenticateReview(config,accounts[0].email,accounts[0].password,"login"))!;
  const token=issueReviewSession(config,identity,100000);
  expect(verifyReviewSession(config,token,100001)).toBe("admin");
  expect(verifyReviewSession(config,token,100000+REVIEW_TTL*1000)).toBeNull();
  expect(verifyReviewSession({...config,secret:secret+"changed"},token,100001)).toBeNull();
  expect(verifyReviewSession({...config,accounts:[]},token,100001)).toBeNull();
  expect(verifyReviewSession({...config,accounts:[{...config.accounts[0],password:"changed-password"}]},token,100001)).toBeNull();
  for(const bad of [undefined,"admin",token+"x",token.replace(token[0],"!"),"a.b.c"]) expect(verifyReviewSession(config,bad,100001)).toBeNull();
  const payload=Buffer.from(token.split(".")[0],"base64url").toString();
  expect(payload).not.toContain(accounts[0].email);expect(payload).not.toContain(accounts[0].password);
 });
});
