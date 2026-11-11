"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {useLocalAccess} from "@/components/access/local-access";
import {Button,buttonStyles} from "@/components/common/button";
import {Input} from "@/components/common/input";
import {Modal} from "@/components/common/modal";
import {useStaffResource} from "@/components/features/live-staff/data";
import {errorText} from "@/components/features/live-staff/model";
import {apiRequest} from "@/lib/api/client";
import {ensureCsrf} from "@/lib/auth/client";
import type {PublicConfig} from "@/types/knowledge";
import type {AssistantStart,AssistantMessage,AssistantHandoff,AssistantTurn,AssistantHistory} from "@/types/assistant";

export function AssistantWidget(){
 const path=usePathname();const {user,ready}=useLocalAccess();
 const config=useStaffResource<PublicConfig>("/public-config");
 const restore=useStaffResource<AssistantHistory>("/assistant/current");
 const recovered=useRef(false);
 const [open,setOpen]=useState(false),[conversation,setConversation]=useState<Pick<AssistantStart,"id"|"token">|null>(null),[messages,setMessages]=useState<AssistantMessage[]>([]),[handoff,setHandoff]=useState<AssistantHandoff|null>(null),[question,setQuestion]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[inquiry,setInquiry]=useState<string|null>(null),[feedback,setFeedback]=useState<Record<string,boolean>>({});
 const owner=useRef<string|null>(null),generation=useRef(0);
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(open&&messages.length)end.current?.scrollIntoView?.({block:"nearest"});},[open,messages.length]);
 useEffect(()=>{
  const previous=owner.current;owner.current=user?.id??null;
  if(previous&&previous!==owner.current){generation.current++;const frame=requestAnimationFrame(()=>{setConversation(null);setMessages([]);setHandoff(null);setQuestion("");setInquiry(null);setError("");setBusy(false);setFeedback({});setOpen(false);});return()=>cancelAnimationFrame(frame);}
 },[user?.id]);
 useEffect(()=>{
  if(restore.loading||recovered.current)return;
  recovered.current=true;
  if(!restore.data||conversation)return;
  const data=restore.data,version=generation.current;
  const frame=requestAnimationFrame(()=>{if(version!==generation.current)return;setConversation({id:data.id,token:null});setMessages(data.messages);setHandoff(data.handoff);setInquiry(data.inquiry_id);});
  return()=>cancelAnimationFrame(frame);
 },[restore.data,restore.loading,conversation]);
 if(!ready||path.startsWith("/staff")||path.startsWith("/admin")||path.includes("-preview/"))return null;
 const contact=config.data?.support;
 const headers=conversation?.token?{"X-Assistant-Token":conversation.token}:undefined;
 async function write<T>(route:string,data?:unknown,tokenHeaders=headers){await ensureCsrf();return(await apiRequest<T>(route,{method:"POST",body:data,headers:tokenHeaders,timeoutMs:30000})).data;}
 async function send(e:FormEvent){e.preventDefault();if(!question.trim()||busy)return;setBusy(true);setError("");const version=generation.current;const content=question.trim();try{
  const active=conversation??await write<AssistantStart>("/assistant/conversations");if(version!==generation.current)return;setConversation(active);
  const result=await write<AssistantTurn>(`/assistant/conversations/${active.id}/messages`,{content},active.token?{"X-Assistant-Token":active.token}:undefined);
  if(version!==generation.current)return;
  setMessages(value=>[...value,{id:crypto.randomUUID(),role:"user",content,created_at:new Date().toISOString(),sources:[]},result.message]);setQuestion("");setHandoff(result.handoff);config.reload();
 }catch(e){if(version===generation.current)setError(errorText(e));}finally{if(version===generation.current)setBusy(false);}}
 async function toTeam(){if(!conversation||busy)return;setBusy(true);setError("");const version=generation.current;try{const result=await write<{inquiry_id:string}>(`/assistant/conversations/${conversation.id}/handoff/message-team`,{});if(version===generation.current)setInquiry(result.inquiry_id);}catch(e){if(version===generation.current)setError(errorText(e));}finally{if(version===generation.current)setBusy(false);}}
 async function reset(){setBusy(true);setError("");try{await ensureCsrf();await apiRequest("/assistant/session",{method:"DELETE"});generation.current++;setConversation(null);setMessages([]);setHandoff(null);setInquiry(null);setFeedback({});recovered.current=true;}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function rate(id:string,helpful:boolean){try{await write(`/assistant/messages/${id}/feedback`,{helpful});setFeedback(value=>({...value,[id]:helpful}));}catch(e){setError(errorText(e));}}
 return <>
  <button type="button" className={`${buttonStyles()} assistant-launcher`} onClick={()=>{config.reload();setOpen(true);}} aria-haspopup="dialog">Ask Kof’a</button>
  <Modal open={open} onClose={()=>setOpen(false)} title="Ask Kof’a">
    {contact&&<section className="assistant-support" aria-label="Assistant support contact">{contact.phone&&<a className={buttonStyles()} href={`tel:${contact.phone}`}>Call {contact.display_phone}</a>}<p>{contact.hours_text}</p><p>{contact.is_open_now?"Support line open now":"Support line currently closed"}</p>{contact.email&&<a href={`mailto:${contact.email}`}>{contact.email}</a>}</section>}
   <div className="assistant-panel">
    <p>{config.data?.assistant.disclosure??"I’m an AI assistant. For questions I cannot answer, our team can help."}</p>
    <p className="text-sm text-muted">Avoid sharing bank details, passwords or identity numbers. Your messages may be reviewed by our team.</p>

    {!!config.error&&<><p role="alert">Support details could not be loaded.</p><Button onClick={config.reload}>Retry support details</Button></>}
    {!config.loading&&!config.error&&!config.data?.assistant.enabled&&<p>The assistant is currently unavailable. You can read Help articles or contact our team.</p>}
    <div className="assistant-messages" role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions">
     {messages.map(message=><article key={message.id} className={`assistant-message ${message.role}`}><p className="font-medium">{message.role==="user"?"You":"Kof’a assistant"}</p><p className="whitespace-pre-wrap break-words">{message.content}</p>{message.sources.map(source=><Link key={source.id} href={source.url} onClick={()=>setOpen(false)}>Source: {source.title}</Link>)}{message.role==="assistant"&&(feedback[message.id]!==undefined?<p>Thank you for your feedback.</p>:<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>void rate(message.id,true)}>Helpful</Button><Button variant="secondary" onClick={()=>void rate(message.id,false)}>Not helpful</Button></div>)}</article>)}
    </div>
    {busy&&<p role="status">Preparing your response…</p>}
    {(handoff||error)&&<section className="assistant-support" aria-label="Contact the team"><p>{handoff?.message??"Please try again shortly, or contact our team using the support details above."}</p>{handoff?.options.some(option=>option.type==="report_listing")&&<Link href="/report" onClick={()=>setOpen(false)}>Report a suspicious listing</Link>}</section>}
    {error&&<p role="alert">{error}</p>}
    {inquiry?<Link className={buttonStyles()} href={`/account/conversation?id=${inquiry}`} onClick={()=>setOpen(false)}>Open your inquiry</Link>:conversation&&user?.role==="client"?<Button onClick={()=>void toTeam()} loading={busy}>Send conversation to our team</Button>:conversation&&!user?<Link className={buttonStyles()} href={`/login?returnTo=${encodeURIComponent(path)}`} onClick={()=>setOpen(false)}>Sign in to message our team</Link>:null}
    {!inquiry&&<form onSubmit={send} className="grid gap-3"><Input label="Your question" value={question} maxLength={1000} required disabled={busy||!config.data?.assistant.enabled} onChange={e=>setQuestion(e.target.value)}/><Button type="submit" loading={busy} disabled={!config.data?.assistant.enabled||!question.trim()}>Send question</Button></form>}
    <div className="flex flex-wrap items-center gap-3"><Link href="/resources/help" onClick={()=>setOpen(false)}>Read Help articles</Link><Link href="/account/general-inquiry" onClick={()=>setOpen(false)}>Message our team</Link>{conversation&&<Button variant="secondary" disabled={busy} onClick={()=>void reset()}>New conversation</Button>}</div>
    <div ref={end}/>
   </div>
  </Modal>
 </>;
}
