"use client";
import Image from "next/image";
export function AssistantTrigger({className=""}:{className?:string}) {
 return <button type="button" className={`assistant-entry ${className}`} aria-haspopup="dialog" onClick={()=>window.dispatchEvent(new Event("kofa:open-assistant"))}><Image src="/assets/kofa-mark.svg" width={20} height={24} alt=""/><span>Ask Kof’a</span></button>;
}
