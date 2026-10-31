"use client";
import {Suspense,useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import {BrandLoading} from "@/components/common/brand-loading";
import {accountSession} from "@/lib/auth/client";
import {reviewDestination} from "@/lib/review-routing";
import {safeReturnPath} from "@/components/features/auth/screens";
function Restore() {
 const params=useSearchParams(); const [error,setError]=useState(false);
 const returnTo=safeReturnPath(params.get("returnTo"));
 useEffect(()=>{
  let active=true;
  accountSession().then(user=>{if(active) window.location.replace(user ? reviewDestination(user.role,returnTo) : `/login?${new URLSearchParams({returnTo})}`);}).catch(()=>{if(active)setError(true);});
  return ()=>{active=false;};
 },[returnTo]);
 if(error) return <main id="main-content" className="page-container"><h1 className="text-2xl">Unable to connect.</h1><p>Account services could not be reached. Please try again.</p><Link href={`/login?${new URLSearchParams({returnTo})}`} className="text-primary underline">Back to sign in</Link></main>;
 return <main id="main-content"><BrandLoading /></main>;
}
export default function Page() {return <Suspense fallback={<BrandLoading />}><Restore /></Suspense>;}
