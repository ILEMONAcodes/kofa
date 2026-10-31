import { notFound } from "next/navigation";
import { MediaHelpScreen } from "@/components/features/media-help/screen";
import { reviewScreens } from "@/components/features/review-feedback/model";
export const metadata = {
  title: "Review and feedback design preview | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return reviewScreens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!reviewScreens.some((s) => s.slug === screen)) notFound();
  return (
    <MediaHelpScreen key={screen} slug={screen} section="review-feedback" />
  );
}
