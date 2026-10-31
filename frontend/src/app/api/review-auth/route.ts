import { NextRequest,NextResponse } from "next/server";
import { currentReviewConfig } from "@/lib/review-server/session";
import { REVIEW_COOKIE,REVIEW_TTL,authenticateReview,issueReviewSession,verifyReviewSession } from "@/lib/review-server/core";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Cookie"};
function sameOrigin(request:NextRequest) {
  try {
    const origin=new URL(request.headers.get("origin") ?? "");
    return origin.origin===request.headers.get("origin") && origin.host===request.headers.get("host") &&
      (origin.protocol==="https:" || origin.protocol==="http:" && ["localhost","127.0.0.1","[::1]"].includes(origin.hostname));
  } catch {return false;}
}
function reply(data:unknown,status=200) {return NextResponse.json(data,{status,headers});}
const attempts=new Map<string,{count:number;until:number}>();
function throttled(request:NextRequest) {
  const key=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "review";
  const now=Date.now();
  const previous=attempts.get(key);
  if(previous && previous.until>now) {previous.count++; return previous.count>100;}
  if(attempts.size>=1000) for(const [k,v] of attempts) {if(v.until<=now) attempts.delete(k);}
  if(attempts.size>=1000) return true;
  attempts.set(key,{count:1,until:now+10*60*1000});return false;
}
export function GET(request:NextRequest) {
  const role=verifyReviewSession(currentReviewConfig(),request.cookies.get(REVIEW_COOKIE)?.value);
  return reply({data:{role}});
}
export async function POST(request:NextRequest) {
  if(!sameOrigin(request)) return reply({message:"Request could not be verified."},403);
  if(throttled(request)) return reply({message:"Too many attempts. Please try again later."},429);
  const config=currentReviewConfig();
  if(!config) return reply({message:"Review sign-in is not configured. Contact the review organiser."},503);
  const reader=request.body?.getReader();
  if(!reader) return reply({message:"Invalid sign-in details."},400);
  const chunks: Uint8Array[]=[]; let size=0;
  try { while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>2048) {await reader.cancel(); return reply({message:"Invalid sign-in details."},400);} chunks.push(value); } } catch { return reply({message:"Invalid sign-in details."},400); }
  const text=Buffer.concat(chunks).toString("utf8");
  let data:unknown;try{data=JSON.parse(text);}catch{return reply({message:"Invalid sign-in details."},400);}
  if(!data || typeof data!=="object") return reply({message:"Invalid sign-in details."},400);
  const body=data as Record<string,unknown>;
  if(Object.keys(body).some(k=>!["email","password","intent"].includes(k)) || typeof body.email!=="string" || body.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || typeof body.password!=="string" || body.password.length<6 || body.password.length>128 || !["login","register"].includes(String(body.intent))) return reply({message:"Invalid sign-in details."},400);
  const identity=await authenticateReview(config,body.email,body.password,body.intent as "login"|"register");
  if(!identity) return reply({message:"Invalid email or password."},401);
  const response=reply({data:{role:identity.role}});
  response.cookies.set(REVIEW_COOKIE,issueReviewSession(config,identity),{httpOnly:true,sameSite:"lax",secure:request.headers.get("origin")?.startsWith("https://") === true,path:"/",maxAge:REVIEW_TTL});
  return response;
}
export function DELETE(request:NextRequest) {
  if(!sameOrigin(request)) return reply({message:"Request could not be verified."},403);
  const response=reply({data:{role:null}});response.cookies.set(REVIEW_COOKIE,"",{httpOnly:true,sameSite:"lax",secure:request.headers.get("origin")?.startsWith("https://") === true,path:"/",maxAge:0});return response;
}
