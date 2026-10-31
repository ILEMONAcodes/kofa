import { requireReviewRole } from "@/lib/review-server/session";
import { Suspense } from "react";
import { BrandLoading } from "@/components/common/brand-loading";
import { notFound } from "next/navigation";
import { ClientJourney } from "@/components/features/client-journeys/client-journey";
import clientScreens from "@/components/features/client-journeys/screens.json";
export const metadata = {
  title: "Client journey | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string,string | string[] | undefined>>;
}) {
  const { screen } = await params;
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(await searchParams)) { if (Array.isArray(value)) value.forEach(item=>query.append(key,item)); else if (value !== undefined) query.set(key,value); }
  await requireReviewRole(["client"], `/account/${screen}${query.size ? `?${query}` : ""}`);
  if (!clientScreens.some(({ slug }) => slug === screen)) notFound();
  return (
    <Suspense fallback={<BrandLoading />}>
      <ClientJourney key={screen} slug={screen} />
    </Suspense>
  );
}
