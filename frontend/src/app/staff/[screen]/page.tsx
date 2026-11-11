import { AssistantWorkspace } from "@/components/features/assistant/workspace";
import { KnowledgeWorkspace } from "@/components/features/knowledge/live";
import { AvailabilityQueue, AvailabilityHistoryPage } from "@/components/features/availability/queue";
import { Suspense } from "react";
import { BrandLoading } from "@/components/common/brand-loading";
import { LiveComplaints } from "@/components/features/complaints/live";
import { staffCaseViews } from "@/components/features/complaints/model";
import { LiveInspections } from "@/components/features/inspections/live";
import { liveInspectionStaffViews } from "@/components/features/inspections/model";
import { LiveInquiries } from "@/components/features/inquiries/live";
import { liveInquiryStaffViews } from "@/components/features/inquiries/model";
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
  if (["assistant", "assistant-review", "assistant-usage"].includes(screen)) return <AssistantWorkspace view={screen} id={typeof search.id === "string" ? search.id : null} />;
  if (["knowledge", "article", "edit-article"].includes(screen)) return <KnowledgeWorkspace view={screen} id={typeof search.id === "string" ? search.id : null} />;
  if (screen === "availability-history") return <AvailabilityHistoryPage id={typeof search.id === "string" ? search.id : null} />;
  if (screen === "availability-queue") return <AvailabilityQueue />;
  if (staffCaseViews.has(screen))
    return (
      <Suspense fallback={<BrandLoading />}>
        <LiveComplaints key={screen} view={screen} staff />
      </Suspense>
    );
  if (!staffScreens.some(({ slug }) => slug === screen)) notFound();
  if (liveInspectionStaffViews.has(screen))
    return <LiveInspections key={screen} view={screen} staff />;
  if (liveInquiryStaffViews.has(screen))
    return <LiveInquiries key={screen} view={screen} staff />;
  if (liveStaffViews.includes(screen))
    return <LiveStaffWorkspace key={screen} view={screen} />;
  return <StaffScreen key={screen} slug={screen} />;
}
