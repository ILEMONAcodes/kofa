"use client";
import {useState,type FormEvent} from "react";
import Link from "next/link";
import {Button,buttonStyles} from "@/components/common/button";
import {Input} from "@/components/common/input";
import {apiRequest} from "@/lib/api/client";
import {ensureCsrf} from "@/lib/auth/client";
import {ApiError} from "@/lib/api/error";
import type {AdminAccount} from "@/types/auth";
export function StaffManagement({members:initial,currentUserId}:{members:AdminAccount[];currentUserId:string}) {
 const [members,setMembers]=useState(initial);const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);
 const [page,setPage]=useState(1);const [more,setMore]=useState(initial.length===20);
 async function add(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setBusy(true);setNotice("");
  try {
   await ensureCsrf();
   const value=await apiRequest<AdminAccount>("/admin/users",{method:"POST",body:{full_name:String(data.get("full_name")),email:String(data.get("email")),phone:String(data.get("phone") ?? "") || null,role:String(data.get("role")),...(data.get("temporary_password") ? {temporary_password:String(data.get("temporary_password"))} : {})}});
   setMembers(previous=>[value.data,...previous]);form.reset();setNotice("Team account created. They can sign in with the temporary password, or use their set-password email when delivery is configured.");
  } catch(issue) {setNotice(issue instanceof ApiError && issue.status<500 ? issue.message : "Unable to update your team. Please try again.");}
  finally {setBusy(false);}
 }
 async function toggle(member:AdminAccount) {
  setBusy(true);setNotice("");
  try {await ensureCsrf();const value=await apiRequest<AdminAccount>(`/admin/users/${member.id}`,{method:"PATCH",body:{is_active:!member.is_active,version:member.version}});setMembers(previous=>previous.map(item=>item.id===member.id ? value.data : item));setNotice("Team access updated.");}
  catch(issue) {setNotice(issue instanceof ApiError && issue.status<500 ? issue.message : "Unable to update access. Please try again.");}
  finally {setBusy(false);}
 }
 async function loadMore() {setBusy(true);try {const result=await apiRequest<AdminAccount[]>("/admin/users",{query:{page:page+1,page_size:20}});setMembers(previous=>[...previous,...result.data.filter(item=>!previous.some(old=>old.id===item.id))]);setPage(previous=>previous+1);setMore(result.data.length===20);}catch{setNotice("Unable to load more accounts. Please try again.");}finally{setBusy(false);}}
 return <main id="main-content" className="page-container space-y-6">
  <Link href="/admin/administration" className="text-primary underline">Back to administration</Link>
  <h1 className="text-3xl">Your team, together.</h1><p>Create staff accounts and manage their access.</p>
  <section className="rounded-xl border bg-surface p-5 space-y-4"><h2 className="text-xl">Add a team member</h2>
   <form onSubmit={add} className="grid gap-4 md:grid-cols-2">
    <Input name="full_name" label="Full name" required minLength={2} maxLength={150}/><Input name="email" label="Email" type="email" required/>
    <Input name="phone" label="Phone (optional)" type="tel" pattern="\+[1-9][0-9]{7,14}"/>
    <label>Role<select name="role" className="field-control mt-2"><option value="staff">Staff</option><option value="admin">Administrator</option></select></label>
    <Input name="temporary_password" label="Temporary password (optional)" type="password" minLength={8} maxLength={128} autoComplete="new-password"/>
    <p className="text-sm text-muted">Use at least 8 characters. Leave blank to send a set-password invitation through the configured email service.</p>
    <Button type="submit" loading={busy}>Add team member</Button>
   </form>
  </section>
  <p role="status">{notice}</p><section aria-label="Team members" className="space-y-4"><h2 className="text-xl">Team members</h2>
   {members.map(member=><article key={member.id} className="rounded-xl border bg-surface p-5 flex flex-wrap items-center gap-4"><div className="flex-1"><h3>{member.full_name}</h3><p>{member.email}</p><p>{member.role === "admin" ? "Administrator" : member.role === "staff" ? "Staff" : "Client"} · {member.is_active ? "Active" : "Inactive"}</p></div><Button variant="secondary" disabled={busy || member.id===currentUserId} onClick={()=>toggle(member)}>{member.is_active ? "Deactivate" : "Activate"} {member.full_name}</Button></article>)}
  </section>{more && <Button onClick={loadMore} loading={busy}>Load more accounts</Button>}
  <Link href="/staff/overview" className={buttonStyles()}>Open staff operations</Link>
 </main>;
}
