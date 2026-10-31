import { notFound } from "next/navigation";
import { StaffScreen } from "@/components/features/staff-operations/staff-screen";
import { administrationScreens } from "@/components/features/administration/model";
export const metadata = {
  title: "Administration | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return administrationScreens.map(({ slug }) => ({ screen: slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!administrationScreens.some(({ slug }) => slug === screen)) notFound();
  return <StaffScreen key={screen} slug={screen} administration />;
}
