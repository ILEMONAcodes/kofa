import { createHmac, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { ReviewRole } from "../review-routing";
export type ReviewConfig = {secret:string; accounts:{email:string;password:string;role:"staff"|"admin"}[]};
export const REVIEW_COOKIE = "kofa_review_session";
export const REVIEW_TTL = 8*60*60;
export function reviewConfig(secret: string|undefined, source: string|undefined): ReviewConfig|null {
  if(!secret || secret.length<32 || !source) return null;
  try {
    const entries:unknown=JSON.parse(source);
    if(!Array.isArray(entries) || entries.length===0 || entries.length>50) return null;
    const accounts:ReviewConfig["accounts"]=[];
    for(const item of entries) {
      if(!item || typeof item!=="object" || typeof item.email!=="string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) || item.email.length>254 || typeof item.password!=="string" || item.password.length<12 || item.password.length>128 || !["staff","admin"].includes(item.role)) return null;
      const email=item.email.trim().toLowerCase();
      if(accounts.some(a=>a.email===email)) return null;
      accounts.push({email,password:item.password,role:item.role});
    }
    return accounts.some(a=>a.role==="admin") ? {secret,accounts} : null;
  } catch {return null;}
}
const mac = (secret:string,value:string) => createHmac("sha256",secret).update(value).digest("base64url");
const fingerprint = (config:ReviewConfig,account:ReviewConfig["accounts"][number]) => mac(config.secret,JSON.stringify([account.email,account.password,account.role]));
const hashPassword = (value:string,salt:string) => new Promise<Buffer>((resolve,reject)=>scrypt(value,salt,64,(error,key)=>error?reject(error):resolve(key)));
export async function authenticateReview(config:ReviewConfig,email:string,password:string,intent:"login"|"register"):Promise<{role:ReviewRole;fingerprint:string}|null> {
  const normalized=email.trim().toLowerCase();
  const account=config.accounts.find(a=>a.email===normalized);
  if(account) {
    if(intent==="register") return null;
    const salt=mac(config.secret,normalized);
    const [given,expected]=await Promise.all([hashPassword(password,salt),hashPassword(account.password,salt)]);
    return timingSafeEqual(given,expected) ? {role:account.role,fingerprint:fingerprint(config,account)} : null;
  }
  // Public review registration/login grants a sample CLIENT only; it never creates staff identities.
  return {role:"client",fingerprint:"review-client-v1"};
}
export function issueReviewSession(config:ReviewConfig,identity:{role:ReviewRole;fingerprint:string},now=Date.now()):string {
  const payload=Buffer.from(JSON.stringify({...identity,sub:randomUUID(),exp:Math.floor(now/1000)+REVIEW_TTL})).toString("base64url");
  return payload+"."+mac(config.secret,payload);
}
export function verifyReviewSession(config:ReviewConfig|null,token:string|undefined,now=Date.now()):ReviewRole|null {
  if(!config || !token || token.length>2048) return null;
  try {
    const parts=token.split("."); if(parts.length!==2) return null;
    const expected=Buffer.from(mac(config.secret,parts[0])); const given=Buffer.from(parts[1]);
    if(given.length!==expected.length || !timingSafeEqual(given,expected)) return null;
    const data=JSON.parse(Buffer.from(parts[0],"base64url").toString());
    if(!data || !Number.isSafeInteger(data.exp) || data.exp<=Math.floor(now/1000) || typeof data.sub!=="string") return null;
    if(data.role==="client" && data.fingerprint==="review-client-v1") return "client";
    const account=config.accounts.find(a=>fingerprint(config,a)===data.fingerprint && a.role===data.role);
    return account?.role ?? null;
  } catch {return null;}
}
