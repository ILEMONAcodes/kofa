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
 const call=handoff?.options.find(option=>option.type==="call");
 const phone=call?.phone??contact?.phone;
 const available=!!config.data?.assistant.enabled;
 return <>
  <button type="button" className={`${buttonStyles()} assistant-launcher`} onClick={()=>{config.reload();setOpen(true);}} aria-haspopup="dialog">Ask Kof’a</button>
  <Modal open={open} onClose={()=>setOpen(false)} title="Ask Kof’a" className="assistant-dialog">
   <div className="assistant-toolbar">
    <span>AI support · Answers from Kof’a</span>
    {phone&&<a href={`tel:${phone}`} aria-label="Call team at Kof’a">Call team</a>}
    <details className="assistant-about"><summary>About &amp; contact</summary><div>
     <p>{config.data?.assistant.disclosure??"I’m an AI assistant. Answers may be imperfect."}</p>
     <p>Avoid sharing passwords, bank details or identity numbers. Our team may review your messages.</p>
     {contact&&<><p>{contact.hours_text}</p><p>{contact.is_open_now?"Support line open now":"Support line currently closed"}</p>{contact.phone&&<a href={`tel:${contact.phone}`}>{contact.display_phone}</a>}{contact.email&&<a href={`mailto:${contact.email}`}>{contact.email}</a>}</>}
    </div></details>
   </div>
   <div className="assistant-body">
    {config.loading&&<p role="status">Connecting…</p>}
    {!!config.error&&<div className="assistant-handoff"><p role="alert">Chat could not connect. Please try again.</p><Button variant="secondary" onClick={config.reload}>Retry connection</Button></div>}
    {!config.loading&&!config.error&&!available&&<div className="assistant-empty"><h3>Chat is offline right now.</h3><p>Our team can still help.</p><Link className={buttonStyles()} href="/account/general-inquiry" onClick={()=>setOpen(false)}>Message our team</Link><Button variant="secondary" onClick={config.reload}>Check connection</Button></div>}
    {available&&messages.length===0&&<div className="assistant-empty"><h3>How can I help?</h3><p>Ask about finding a home or inspections.</p><div className="assistant-suggestions">{["How does verification work?","How do I prepare for an inspection?"].map(text=><button key={text} type="button" onClick={()=>setQuestion(text)}>{text}</button>)}</div></div>}
    <div className="assistant-messages" role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions">
     {messages.map(message=><article key={message.id} className={`assistant-message ${message.role}`}><p className="assistant-speaker">{message.role==="user"?"You":"Kof’a"}</p><p className="whitespace-pre-wrap break-words">{message.content}</p>{message.sources.map(source=><Link key={source.id} href={source.url} onClick={()=>setOpen(false)}>Source: {source.title}</Link>)}{message.role==="assistant"&&(feedback[message.id]!==undefined?<small>Thanks for your feedback.</small>:<div className="assistant-feedback"><button type="button" aria-label="Mark answer helpful" onClick={()=>void rate(message.id,true)}>Helpful</button><button type="button" aria-label="Mark answer not helpful" onClick={()=>void rate(message.id,false)}>Not helpful</button></div>)}</article>)}
    </div>
    {busy&&<p role="status" className="assistant-thinking">Thinking…</p>}
    {(handoff||error)&&<section className="assistant-handoff" aria-label="Contact the team"><p>{handoff?.message??"Try again, or contact our team."}</p>{handoff?.options.some(option=>option.type==="report_listing")&&<Link href="/report" onClick={()=>setOpen(false)}>Report a suspicious listing</Link>}</section>}
    {error&&<p role="alert">{error}</p>}
    {inquiry?<Link className={buttonStyles()} href={`/account/conversation?id=${inquiry}`} onClick={()=>setOpen(false)}>Open your inquiry</Link>:conversation&&user?.role==="client"?<Button onClick={()=>void toTeam()} loading={busy} aria-label="Send to our team">Send to our team</Button>:conversation&&!user?<Link className={buttonStyles()} href={`/login?returnTo=${encodeURIComponent(path)}`} onClick={()=>setOpen(false)}>Sign in to message our team</Link>:null}
    <div ref={end}/>
   </div>
   <div className="assistant-footer">
    {available&&!inquiry&&<form onSubmit={send} className="assistant-composer"><Input label="Your question" value={question} maxLength={1000} required disabled={busy} onChange={e=>setQuestion(e.target.value)}/><Button type="submit" aria-label="Send question" loading={busy} disabled={!question.trim()}>Send</Button></form>}
    <div className="assistant-footer-links"><Link href="/resources/help" onClick={()=>setOpen(false)}>Help articles</Link>{available&&<Link href="/account/general-inquiry" onClick={()=>setOpen(false)}>Message our team</Link>}{conversation&&<button type="button" disabled={busy} onClick={()=>void reset()}>New conversation</button>}</div>
   </div>
  </Modal>
 </>;
}
