import { AdminReports } from "@/components/features/reports/dashboard";
import { redirect } from "next/navigation";
import { staffCaseViews } from "@/components/features/complaints/model";
import { requireReviewRole } from "@/lib/review-server/session";
import { notFound } from "next/navigation";
import { StaffScreen } from "@/components/features/staff-operations/staff-screen";
import { administrationScreens } from "@/components/features/administration/model";
export const metadata = {
  title: "Administration | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (staffCaseViews.has(screen)) redirect(`/staff/${screen}`);
  await requireReviewRole(["admin"], `/admin/${screen}`);
  if (["overview", "reports"].includes(screen)) return <AdminReports reports={screen === "reports"} />;
  if (!administrationScreens.some(({ slug }) => slug === screen)) notFound();
  return <StaffScreen key={screen} slug={screen} administration />;
}
