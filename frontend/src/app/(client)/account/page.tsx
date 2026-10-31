import { redirect } from "next/navigation";
import { currentReviewRole } from "@/lib/review-server/session";
import { reviewHome } from "@/lib/review-routing";
export default async function Page() { const role = await currentReviewRole(); redirect(role ? reviewHome(role) : "/login?returnTo=%2Faccount%2Foverview"); }
