import { LiveStaffWorkspace } from "@/components/features/live-staff/workspace";
import { liveStaffViews } from "@/components/features/live-staff/model";
import { requireReviewRole } from "@/lib/review-server/session";
import { notFound } from "next/navigation";
import { StaffScreen } from "@/components/features/staff-operations/staff-screen";
import { staffScreens } from "@/components/features/staff-operations/model";
export const metadata = {
  title: "Staff operations | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  const query = new URLSearchParams();
  const search = await searchParams;
  for (const [key, value] of Object.entries(search))
    if (typeof value === "string") query.set(key, value);
  await requireReviewRole(
    ["staff", "admin"],
    `/staff/${screen}${query.size ? `?${query}` : ""}`,
  );
  if (!staffScreens.some(({ slug }) => slug === screen)) notFound();
  if (liveStaffViews.includes(screen))
    return <LiveStaffWorkspace key={screen} view={screen} />;
  return <StaffScreen key={screen} slug={screen} />;
}
