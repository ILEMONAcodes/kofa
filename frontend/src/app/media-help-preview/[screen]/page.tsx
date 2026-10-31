import { redirect, notFound } from "next/navigation";
import { mediaScreens as screens } from "@/components/features/media-help/model";
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
  redirect(`/resources/${screen}`);
}
