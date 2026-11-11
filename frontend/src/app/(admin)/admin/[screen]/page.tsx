import { KnowledgeWorkspace } from "@/components/features/knowledge/live";
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
  params, searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  if (staffCaseViews.has(screen)) redirect(`/staff/${screen}`);
  await requireReviewRole(["admin"], `/admin/${screen}`);
  const search = await searchParams;
  if (["draft-saved", "publish-article", "unpublish-article"].includes(screen)) redirect(typeof search.id === "string" ? `/admin/article?id=${encodeURIComponent(search.id)}` : "/admin/knowledge");
  if (["review-support-settings", "settings-recorded"].includes(screen)) redirect("/admin/support-settings");
  if (["knowledge", "article", "edit-article", "support-settings"].includes(screen)) return <KnowledgeWorkspace view={screen} id={typeof search.id === "string" ? search.id : null} />;
  if (["overview", "reports"].includes(screen)) return <AdminReports reports={screen === "reports"} />;
  if (!administrationScreens.some(({ slug }) => slug === screen)) notFound();
  return <StaffScreen key={screen} slug={screen} administration />;
}
