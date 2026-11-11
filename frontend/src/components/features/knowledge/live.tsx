"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLocalAccess } from "@/components/access/local-access";
import { Button, buttonStyles } from "@/components/common/button";
import { Input } from "@/components/common/input";
import { Dropdown } from "@/components/common/dropdown";
import { BrandLoading } from "@/components/common/brand-loading";
import { InspectionFrame } from "@/components/features/inspections/frame";
import { useStaffResource, staffWrite } from "@/components/features/live-staff/data";
import { errorText, words } from "@/components/features/live-staff/model";
import type { PublicConfig, PublicHelpArticle, StaffHelpArticle, SupportSettings } from "@/types/knowledge";
import { knowledgeCategories } from "@/types/knowledge";
const categories=knowledgeCategories.map(value=>({value,label:words(value)}));
const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function Contact() {
 const result=useStaffResource<PublicConfig>("/public-config");
 const support=result.data?.support;
 return <section className="live-staff-panel" aria-label="Contact Kof’a">
  <h2>Speak to our team.</h2>
  {result.loading?<BrandLoading/>:result.error?<><p role="alert">Support details could not be loaded.</p><Button onClick={result.reload}>Retry support details</Button></>:support?<>
   {support.phone&&<a className={buttonStyles()} href={`tel:${support.phone}`}>Call {support.display_phone}</a>}
   {support.email&&<a href={`mailto:${support.email}`}>{support.email}</a>}
   <p>{support.hours_text}</p>
   <p>{support.is_open_now?"Our support line is open now.":"Our support line is currently closed."}</p>
   <Link href="/account/general-inquiry">Send an inquiry</Link>
   <Link href="/report">Report a listing</Link>
  </>:null}
 </section>;
}

export function PublicHelp({slug=null}:{slug?:string|null}) {
 const [search,setSearch]=useState(""),[q,setQ]=useState(""),[page,setPage]=useState(1),[category,setCategory]=useState("");
 const query=new URLSearchParams({page:String(page),...(q?{q}:{}),...(category?{category}:{})}).toString();
 const list=useStaffResource<PublicHelpArticle[]>(slug?null:"/knowledge-articles",query);
 const article=useStaffResource<PublicHelpArticle>(slug?`/knowledge-articles/${encodeURIComponent(slug)}`:null);
 const result=slug?article:list;
 return <InspectionFrame staff={false} homeHref="/" backHref="/" helpTitle="Contact Kof’a" helpText="Use the support details on this page or send an inquiry to speak with our team."><div className="operational-dashboard">
  <h1>{slug?article.data?.title??"Help article":"A little help for your next move."}</h1>
  <Contact/>
  {!slug&&<form className="live-staff-panel" onSubmit={e=>{e.preventDefault();setPage(1);setQ(search);}}>
   <Input label="Search help articles" value={search} maxLength={150} onChange={e=>setSearch(e.target.value)}/>
   <Dropdown label="Help topic" value={category} options={[{value:"",label:"All topics"},...categories]} onChange={e=>{setCategory(e.target.value);setPage(1);}}/>
   <Button type="submit">Search articles</Button>
  </form>}
  {result.loading?<BrandLoading/>:result.error?<><p role="alert">This help content is unavailable. It may have been updated or removed.</p><Button onClick={result.reload}>Try again</Button></>:slug?article.data&&<article className="live-staff-panel"><p>{words(article.data.category)}</p><div className="whitespace-pre-wrap break-words">{article.data.body}</div></article>:list.data?.length?<>
   {list.data.map(row=><Link className="live-staff-panel" key={row.slug} href={`/resources/article?slug=${encodeURIComponent(row.slug)}`}><h2>{row.title}</h2><p>{words(row.category)}</p></Link>)}
   <div className="live-staff-actions"><Button variant="secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={!list.meta||page>=list.meta.total_pages} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
  </>:<p>No published help articles match your search.</p>}
  {slug&&<Link href="/resources/help">Back to help articles</Link>}
 </div></InspectionFrame>;
}

function ArticleEditor({row,refresh}:{row:StaffHelpArticle|null;refresh:()=>void}) {
 const {role}=useLocalAccess(); const router=useRouter(); const prefix=role==="admin"?"/admin":"/staff";
 const [title,setTitle]=useState(row?.title??""),[body,setBody]=useState(row?.body??""),[category,setCategory]=useState(row?.category??"how_it_works");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 async function save(event:FormEvent){event.preventDefault();setBusy(true);setError("");setMessage("");try{
  const value=await staffWrite<StaffHelpArticle>(row?`/admin/knowledge-articles/${row.id}`:"/admin/knowledge-articles",row?"PATCH":"POST",{title,body,category,language:"en",...(row?{version:row.version}:{})});
  setMessage("Draft saved."); if(!row)router.push(`${prefix}/article?id=${value.id}`);else refresh();
 }catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function publish(action:string){if(!row)return;setBusy(true);setError("");try{await staffWrite(`/admin/knowledge-articles/${row.id}/${action}`,"POST",{version:row.version});refresh();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <>
  {row&&<p>Status: {words(row.status)}</p>}
  <form className="live-staff-panel" onSubmit={save}>
   <Input label="Article title" value={title} required minLength={3} maxLength={160} disabled={row?.status==="published"} onChange={e=>setTitle(e.target.value)}/>
   <Dropdown label="Article topic" options={categories} value={category} disabled={row?.status==="published"} onChange={e=>setCategory(e.target.value as typeof category)}/>
   <label className="live-staff-stack">Article body<textarea className="field-control min-h-64" required minLength={20} maxLength={30000} value={body} disabled={row?.status==="published"} onChange={e=>setBody(e.target.value)}/></label>
   <p>Only publish content approved for public Help. Published articles must be unpublished before editing.</p>
   {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
   {row?.status!=="published"&&<Button type="submit" loading={busy}>Save draft</Button>}
  </form>
  {row&&role==="admin"&&<Button loading={busy} onClick={()=>void publish(row.status==="draft"?"publish":"unpublish")}>{row.status==="draft"?"Publish article":"Unpublish article"}</Button>}
  {row?.status==="published"&&<Link href={`/resources/article?slug=${row.slug}`}>Read public article</Link>}
  <Button variant="secondary" onClick={refresh}>Reload article</Button>
 </>;
}

function SettingsEditor({data,refresh}:{data:SupportSettings;refresh:()=>void}) {
 const {role}=useLocalAccess();
 const [phone,setPhone]=useState(data.support_phone??""),[email,setEmail]=useState(data.support_email??"");
 const [schedule,setSchedule]=useState(days.map((_,day)=>({day,enabled:!!data.support_hours.days.find(d=>d.day===day),open:data.support_hours.days.find(d=>d.day===day)?.open??"09:00",close:data.support_hours.days.find(d=>d.day===day)?.close??"16:00"})));
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await staffWrite("/admin/settings","PUT",{version:data.version,support_phone:phone||null,support_email:email||null,support_hours:{timezone:"Africa/Lagos",days:schedule.filter(d=>d.enabled).map(({day,open,close})=>({day,open,close}))},assistant_enabled:data.assistant_enabled,assistant_daily_token_budget:data.assistant_daily_token_budget});setMessage("Support settings saved.");refresh();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <form onSubmit={save} className="live-staff-stack">
  <Input label="Support phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} hint="International format, such as +2348145935403" disabled={role!=="admin"}/>
  <Input label="Support email" type="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={role!=="admin"}/>
  <p>Hours use Africa/Lagos time. Closing earlier than opening crosses midnight; equal times mean 24 hours. Leave a day unchecked when closed.</p>
  {schedule.map((day,index)=><fieldset key={day.day} className="live-staff-panel"><legend>{days[day.day]}</legend>
   <label><input type="checkbox" checked={day.enabled} disabled={role!=="admin"} onChange={e=>setSchedule(value=>value.map((d,i)=>i===index?{...d,enabled:e.target.checked}:d))}/> Open on {days[day.day]}</label>
   <Input label={`${days[day.day]} opens`} type="time" value={day.open} disabled={!day.enabled||role!=="admin"} onChange={e=>setSchedule(value=>value.map((d,i)=>i===index?{...d,open:e.target.value}:d))}/>
   <Input label={`${days[day.day]} closes`} type="time" value={day.close} disabled={!day.enabled||role!=="admin"} onChange={e=>setSchedule(value=>value.map((d,i)=>i===index?{...d,close:e.target.value}:d))}/>
  </fieldset>)}
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {role==="admin"&&<Button type="submit" loading={busy}>Save support settings</Button>}
  <Button variant="secondary" onClick={refresh}>Reload settings</Button>
 </form>;
}

export function KnowledgeWorkspace({view,id=null}:{view:string;id?:string|null}) {
 const {role}=useLocalAccess();const prefix=role==="admin"?"/admin":"/staff";
 const [notice,setNotice]=useState("");
 const [status,setStatus]=useState(""),[page,setPage]=useState(1),[search,setSearch]=useState(""),[q,setQ]=useState("");
 const settings=useStaffResource<SupportSettings>(view==="support-settings"?"/admin/settings":null);
 const list=useStaffResource<StaffHelpArticle[]>(view==="knowledge"?"/admin/knowledge-articles":null,new URLSearchParams({page:String(page),...(status?{status}:{}),...(q?{q}:{})}).toString());
 const detail=useStaffResource<StaffHelpArticle>(id&&view!=="knowledge"&&view!=="support-settings"?`/admin/knowledge-articles/${encodeURIComponent(id)}`:null);
 const result=view==="knowledge"?list:view==="support-settings"?settings:detail;
 return <InspectionFrame staff><div className="operational-dashboard">
  <h1>{view==="support-settings"?"Keep support within reach.":view==="knowledge"?"Helpful answers, carefully published.":id?"Review your article.":"Write a helpful answer."}</h1>
  <div className="live-staff-actions"><Link href={`${prefix}/knowledge`}>Knowledge base</Link>{role==="admin"&&<Link href="/admin/support-settings">Support settings</Link>}<Link href="/resources/help">Public Help</Link><Link href={`${prefix}/assistant`}>Assistant review</Link>{role==="admin"&&<Link href="/admin/assistant-usage">Assistant usage</Link>}</div>
  {notice&&<p role="status">{notice}</p>}
  {view==="knowledge"?<>
   <Link className={buttonStyles()} href={`${prefix}/edit-article`}>Create article</Link>
   <form className="live-staff-panel" onSubmit={e=>{e.preventDefault();setPage(1);setQ(search);}}><Input label="Search knowledge articles" value={search} maxLength={150} onChange={e=>setSearch(e.target.value)}/><Dropdown label="Article status" value={status} options={[{value:"",label:"All statuses"},{value:"draft",label:"Draft"},{value:"published",label:"Published"}]} onChange={e=>{setStatus(e.target.value);setPage(1);}}/><Button type="submit">Search articles</Button></form>
   {list.loading?<BrandLoading/>:list.error?<><p role="alert">{errorText(list.error)}</p><Button onClick={list.reload}>Try again</Button></>:list.data?.length?list.data.map(row=><Link className="live-staff-panel" key={row.id} href={`${prefix}/article?id=${row.id}`}><h2>{row.title}</h2><p>{words(row.status)} · {words(row.category)}</p></Link>):<p>No articles match these filters.</p>}
   <div className="live-staff-actions"><Button variant="secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={!list.meta||page>=list.meta.total_pages} onClick={()=>setPage(p=>p+1)}>Next</Button></div>
  </>:result.loading?<BrandLoading/>:result.error?<><p role="alert">{errorText(result.error)}</p><Button onClick={result.reload}>Try again</Button></>:view==="support-settings"?settings.data&&<SettingsEditor key={settings.data.version} data={settings.data} refresh={()=>{setNotice("Support settings refreshed.");settings.reload();}}/>:id?detail.data&&<ArticleEditor key={detail.data.version} row={detail.data} refresh={()=>{setNotice("Article refreshed.");detail.reload();}}/>:<ArticleEditor row={null} refresh={()=>{}}/>}
 </div></InspectionFrame>;
}
