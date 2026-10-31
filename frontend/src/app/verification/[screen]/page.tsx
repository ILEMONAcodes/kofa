import { LocalGate } from "@/components/access/local-access";
import { notFound } from "next/navigation";
import { MediaHelpScreen } from "@/components/features/media-help/screen";
import { verificationScreens } from "@/components/features/verification/model";
export const metadata = {
  title: "Verification and transactions | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return verificationScreens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!verificationScreens.some((s) => s.slug === screen)) notFound();
  const view = (
    <MediaHelpScreen key={screen} slug={screen} section="verification" />
  );
  return (
    <LocalGate
      area={!["agreement", "completed"].includes(screen) ? "staff" : "client"}
    >
      {view}
    </LocalGate>
  );
}
