import { notFound } from "next/navigation";
import { StaffScreen } from "@/components/features/staff-operations/staff-screen";
import { staffScreens } from "@/components/features/staff-operations/model";
export const metadata = {
  title: "Staff operations | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return staffScreens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!staffScreens.some(({ slug }) => slug === screen)) notFound();
  return <StaffScreen key={screen} slug={screen} />;
}
