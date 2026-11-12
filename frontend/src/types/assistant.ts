import type { PublicConfig } from "./knowledge";
export interface AssistantSource {type:"article"|"property";id:string;title:string;url:string}
export interface AssistantMessage {id:string;role:"user"|"assistant";content:string;created_at:string;sources:AssistantSource[]}
export interface AssistantHandoff {required:true;reason:string;message:string;options:{type:"call"|"message_team"|"report_listing";phone:string|null;display_phone:string|null;hours_text:string|null;is_open_now:boolean|null;requires_login:boolean|null;url:string|null}[]}
export interface AssistantStart {id:string;token:string|null;greeting:string;disclosure:string;support:PublicConfig["support"]}
export interface AssistantTurn {message:AssistantMessage;handoff:AssistantHandoff|null}
export interface AssistantReview {id:string;status:string;handoff_reason:string|null;flagged:boolean;version:number;created_at:string;updated_at:string;messages?:AssistantMessage[];review_note?:string;inquiry_id?:string|null}
export interface AssistantUsage {day:string;timezone:string;enabled:boolean;readiness_issues:string[];provider_ready:boolean;provider:string;model:string;token_limit:number;request_limit:number;reserved_tokens:number;requests:number;tokens_in:number;tokens_out:number;unknown_usage_requests:number;remaining_tokens:number;remaining_requests:number}

export interface AssistantHistory {id:string;status:string;messages:AssistantMessage[];handoff:AssistantHandoff|null;inquiry_id:string|null}
