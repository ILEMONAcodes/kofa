import { redirect } from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<{returnTo?:string}>}) { const {returnTo}=await searchParams; redirect(`/login${returnTo ? `?${new URLSearchParams({returnTo})}` : ""}`); }
