import { notFound } from "next/navigation";
import { MediaHelpScreen } from "@/components/features/media-help/screen";
import { responsiveScreens } from "@/components/features/responsive-reference/model";
export const metadata = {
  title: "360 px responsive design preview | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return responsiveScreens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!responsiveScreens.some((s) => s.slug === screen)) notFound();
  return <MediaHelpScreen key={screen} slug={screen} section="responsive" />;
}
