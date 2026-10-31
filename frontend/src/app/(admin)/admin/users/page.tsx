import {cookies} from "next/headers";
import {StaffManagement} from "@/components/access/staff-management";
import {backendSession,requireAccountRole} from "@/lib/auth/server";
import type {AdminAccount} from "@/types/auth";
import Link from "next/link";
export default async function Page() {
 await requireAccountRole(["admin"],"/admin/users");
 const {user}=await backendSession();
 let members: AdminAccount[] | null = null;
 try {
  const jar=await cookies();const response=await fetch(`${process.env.API_ORIGIN ?? "http://127.0.0.1:8000"}/api/v1/admin/users`,{headers:{Cookie:`access_token=${encodeURIComponent(jar.get("access_token")?.value ?? "")}`},cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error("Unavailable");
  const data=await response.json();
  members=data.data as AdminAccount[];
 } catch {}
 if (!members) return <main id="main-content" className="page-container"><h1 className="text-2xl">Unable to load your team.</h1><p>Please reload and try again.</p><Link href="/admin/administration">Back to administration</Link></main>;
 return <StaffManagement members={members} currentUserId={user!.id} />;
}
