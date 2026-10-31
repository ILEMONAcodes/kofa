import { BrandLoading } from "@/components/common/brand-loading";
import { notFound } from "next/navigation";
import { MediaHelpScreen } from "@/components/features/media-help/screen";
import { mediaScreens } from "@/components/features/media-help/model";
export const metadata = {
  title: "Media and help | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return mediaScreens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!mediaScreens.some((s) => s.slug === screen)) notFound();
  if (screen === "loading")
    return (
      <main id="main-content">
        <BrandLoading />
      </main>
    );
  return <MediaHelpScreen key={screen} slug={screen} />;
}
