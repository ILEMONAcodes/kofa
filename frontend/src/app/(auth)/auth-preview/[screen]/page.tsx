import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AuthScreenView } from "@/components/features/auth/auth-screen";
import {
  authScreens,
  type AuthScreen,
} from "@/components/features/auth/screens";
export const metadata = {
  title: "Kof’a — authentication design preview",
  robots: { index: false, follow: false },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(authScreens).map((screen) => ({ screen }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!Object.hasOwn(authScreens, screen)) notFound();
  return (
    <Suspense fallback={<p className="p-5">Loading…</p>}>
      <AuthScreenView screen={screen as AuthScreen} preview />
    </Suspense>
  );
}
