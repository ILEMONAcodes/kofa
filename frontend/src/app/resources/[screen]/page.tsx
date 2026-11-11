import { PublicHelp } from "@/components/features/knowledge/live";
import { redirect } from "next/navigation";
import { PolicyDraftPage } from "@/content/policies/page";
import { requireReviewRole } from "@/lib/review-server/session";
import { BrandLoading } from "@/components/common/brand-loading";
import { notFound } from "next/navigation";
import { MediaHelpScreen } from "@/components/features/media-help/screen";
import { mediaScreens } from "@/components/features/media-help/model";
export const metadata = {
  title: "Media and help | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export function generateStaticParams() {
  return mediaScreens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  const search = await searchParams;
  if (screen === "help" || screen === "article") return <PublicHelp slug={screen === "article" && typeof search.slug === "string" ? search.slug : null} />;
  if (
    [
      "report",
      "report-evidence",
      "report-received",
      "duplicate-report",
    ].includes(screen)
  )
    redirect("/report");
  if (screen === "terms" || screen === "privacy")
    return <PolicyDraftPage type={screen} />;
  if (screen === "conflict")
    await requireReviewRole(["staff", "admin"], "/resources/conflict");
  if (!mediaScreens.some((s) => s.slug === screen)) notFound();
  if (screen === "loading")
    return (
      <main id="main-content">
        <BrandLoading />
      </main>
    );
  return <MediaHelpScreen key={screen} slug={screen} />;
}
