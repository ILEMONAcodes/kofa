import { requireReviewRole } from "@/lib/review-server/session";
import { LocalGate } from "@/components/access/local-access";
import { notFound } from "next/navigation";
import { MediaHelpScreen } from "@/components/features/media-help/screen";
import { reviewScreens } from "@/components/features/review-feedback/model";
export const metadata = {
  title: "Review and feedback | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  await requireReviewRole(screen === "feedback" ? ["client"] : ["staff", "admin"], `/review/${screen}`);
  if (!reviewScreens.some((s) => s.slug === screen)) notFound();
  const view = (
    <MediaHelpScreen key={screen} slug={screen} section="review-feedback" />
  );
  return (
    <LocalGate area={screen !== "feedback" ? "staff" : "client"}>
      {view}
    </LocalGate>
  );
}
