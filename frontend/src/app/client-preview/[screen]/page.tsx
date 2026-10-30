import { notFound } from "next/navigation";
import { ClientJourney } from "@/components/features/client-journeys/client-journey";
import clientScreens from "@/components/features/client-journeys/screens.json";
export const metadata = {
  title: "Client journey design preview | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return clientScreens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!clientScreens.some(({ slug }) => slug === screen)) notFound();
  return <ClientJourney key={screen} slug={screen} />;
}
