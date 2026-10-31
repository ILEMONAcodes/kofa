import { requireReviewRole } from "@/lib/review-server/session";
import { notFound } from "next/navigation";
import { MediaHelpScreen } from "@/components/features/media-help/screen";
import { responsiveScreens } from "@/components/features/responsive-reference/model";
export const metadata = {
  title: "Your next step | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (screen !== "media") await requireReviewRole(["inquiry", "inquiries", "conversation"].includes(screen) ? ["client"] : screen === "investigation" ? ["admin"] : ["staff", "admin"], `/responsive-preview/${screen}`);
  if (!responsiveScreens.some((s) => s.slug === screen)) notFound();
  return <MediaHelpScreen key={screen} slug={screen} section="responsive" />;
}
