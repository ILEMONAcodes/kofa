import { redirect, notFound } from "next/navigation";
import { verificationScreens as screens } from "@/components/features/verification/model";
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
  redirect(`/verification/${screen}`);
}
