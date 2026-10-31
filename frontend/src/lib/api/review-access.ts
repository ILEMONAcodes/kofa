import type { ReviewRole } from "@/lib/review-routing";

export async function reviewAccessRequest(
  method: "GET" | "POST" | "DELETE",
  body?: { email: string; password: string; intent: "login" | "register" },
): Promise<ReviewRole | null> {
  let response: Response;
  try {
    response = await fetch("/api/review-auth", {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Account services could not be reached. Please try again.");
  }
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Account services are unavailable. Please try again."); }
  if (!response.ok)
    throw new Error(typeof data?.message === "string" ? data.message : "Unable to continue. Please try again.");
  const role = data?.data?.role;
  return role === "client" || role === "staff" || role === "admin" ? role : null;
}
