import {apiRequest, refreshSession} from "@/lib/api/client";
import {ApiError} from "@/lib/api/error";
import type {AccountUser, CurrentPolicies, Registration} from "@/types/auth";
let bootstrap: Promise<void> | null = null;
function hasCsrf() { return typeof document !== "undefined" && document.cookie.split("; ").some(c=>c.startsWith("csrf_token=")); }
export async function ensureCsrf() {
  if(hasCsrf()) return;
  if(!bootstrap) bootstrap=apiRequest("/auth/csrf").then(()=>{}).finally(()=>{bootstrap=null;});
  await bootstrap;
}
export async function accountSession():Promise<AccountUser|null> {
  try {return (await apiRequest<AccountUser>("/auth/me")).data;}
  catch(error) {
    if(!(error instanceof ApiError) || error.status!==401) throw error;
    // The browser may already have removed the expired access cookie. The
    // refresh cookie is intentionally sent only to /api/v1/auth/*.
    if(error.code!=="TOKEN_EXPIRED" && hasCsrf()) {
      try {await refreshSession(); return (await apiRequest<AccountUser>("/auth/me")).data;}
      catch(issue) {if(!(issue instanceof ApiError) || issue.status!==401) throw issue;}
    }
    return null;
  }
}
export async function signIn(email:string,password:string) {
  await ensureCsrf();return (await apiRequest<AccountUser>("/auth/login",{method:"POST",body:{email,password}})).data;
}
export async function registerAccount(data:Registration) {
  await ensureCsrf();return (await apiRequest<AccountUser>("/auth/register",{method:"POST",body:data})).data;
}
export async function signOut() {await ensureCsrf();await apiRequest("/auth/logout",{method:"POST"});}
export async function currentPolicies() {return (await apiRequest<CurrentPolicies>("/policies/current")).data;}
export async function requestPasswordReset(email:string) {await ensureCsrf();await apiRequest("/auth/password-reset/request",{method:"POST",body:{email}});}
export async function confirmPasswordReset(token:string,new_password:string) {await ensureCsrf();await apiRequest("/auth/password-reset/confirm",{method:"POST",body:{token,new_password}});}
export async function verifyEmail(token:string) {await ensureCsrf();await apiRequest("/auth/email-verification/confirm",{method:"POST",body:{token}});}
export async function resendVerification() {await ensureCsrf();await apiRequest("/auth/email-verification/request",{method:"POST"});}
