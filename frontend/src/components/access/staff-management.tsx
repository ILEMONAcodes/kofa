import Link from "next/link";
import { buttonStyles } from "@/components/common/button";
export function StaffManagement({members}: {members: {email: string; role: "staff" | "admin"}[]}) {
 return <main id="main-content" className="page-container space-y-6">
 <Link href="/admin/administration" className="text-primary underline">Back to administration</Link>
 <h1 className="text-3xl">Your team, together.</h1>
 <p>Team review accounts are managed privately by the review organiser. To add or remove access, update the hosting account configuration and redeploy. Email invitations will be available when account services are connected.</p>
 <section className="space-y-4" aria-label="Team members"><h2 className="text-xl">Team members</h2>
 {members.map(member => <article key={member.email} className="rounded-xl border bg-surface p-5"><h3>{member.email}</h3><p>{member.role === "admin" ? "Administrator" : "Staff"} · Active</p></article>)}</section>
 <Link href="/staff/overview" className={buttonStyles()}>Open staff operations</Link>
 </main>;
}
