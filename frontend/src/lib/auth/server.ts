import "server-only";
import {cookies} from "next/headers";
import {notFound,redirect} from "next/navigation";
import type {AccountRole, AccountUser} from "@/types/auth";
export async function backendSession():Promise<{user:AccountUser|null;unavailable:boolean}> {
 const jar=await cookies();
 const token=jar.get("access_token")?.value;
 if(!token) return {user:null,unavailable:false};
 try {
  const response=await fetch(`${process.env.API_ORIGIN ?? "http://127.0.0.1:8000"}/api/v1/auth/me`,{
   headers:{Cookie:`access_token=${encodeURIComponent(token)}`},cache:"no-store",signal:AbortSignal.timeout(10000),
  });
  if(response.status===401) return {user:null,unavailable:false};
  if(!response.ok) return {user:null,unavailable:true};
  const data=await response.json();
  const user=data.data;
  if(!user || !["client","staff","admin"].includes(user.role)) return {user:null,unavailable:true};
  return {user,unavailable:false};
 } catch {return {user:null,unavailable:true};}
}
export async function currentAccountRole() {return (await backendSession()).user?.role ?? null;}
export async function requireAccountRole(allowed:readonly AccountRole[],returnTo:string) {
 const session=await backendSession();
 if(!session.user) redirect(`/session/restore?${new URLSearchParams({returnTo})}`);
 if(!allowed.includes(session.user.role)) notFound();
 return session.user.role;
}
