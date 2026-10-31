import { redirect, notFound } from "next/navigation";
import screens from "@/components/features/client-journeys/screens.json";
export const dynamicParams = false;
export function generateStaticParams() {
  return screens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!screens.some((item) => item.slug === screen)) notFound();
  redirect(`/account/${screen}`);
}
