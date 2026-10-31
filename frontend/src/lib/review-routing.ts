import { safeReturnPath } from "@/components/features/auth/screens";
export type ReviewRole = "client" | "staff" | "admin";
export const reviewHome = (role: ReviewRole) => role === "admin" ? "/admin/administration" : role === "staff" ? "/staff/overview" : "/account/overview";
export function reviewDestination(role: ReviewRole, requested: string | null): string {
  if (!requested) return reviewHome(role);
  const path = safeReturnPath(requested);
  const pathname = new URL(path,"https://kofa.invalid").pathname;
  if (pathname === "/properties" || pathname.startsWith("/properties/")) return path;
  if (role === "client" && pathname.startsWith("/account/")) return path;
  if (role === "client" && ["/review/feedback", "/verification/agreement", "/verification/completed"].includes(pathname)) return path;
  if ((role === "staff" || role === "admin") && (pathname.startsWith("/staff/") && pathname !== "/staff/login" || pathname.startsWith("/review/") || pathname.startsWith("/verification/"))) return path;
  if (role === "admin" && pathname.startsWith("/admin/")) return path;
  return reviewHome(role);
}
