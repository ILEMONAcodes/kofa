import { LiveComplaints } from "@/components/features/complaints/live";
import { clientCaseViews } from "@/components/features/complaints/model";
import { LiveInspections } from "@/components/features/inspections/live";
import { liveInspectionClientViews } from "@/components/features/inspections/model";
import { LiveInquiries } from "@/components/features/inquiries/live";
import { liveClientViews } from "@/components/features/inquiries/model";
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
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  await requireReviewRole(
    ["client"],
    `/account/${screen}${query.size ? `?${query}` : ""}`,
  );
  if (clientCaseViews.has(screen))
    return (
      <Suspense fallback={<BrandLoading />}>
        <LiveComplaints key={screen} view={screen} />
      </Suspense>
    );
  if (!clientScreens.some(({ slug }) => slug === screen)) notFound();
  if (liveInspectionClientViews.has(screen))
    return (
      <Suspense fallback={<BrandLoading />}>
        <LiveInspections key={screen} view={screen} />
      </Suspense>
    );
  return (
    <Suspense fallback={<BrandLoading />}>
      {liveClientViews.has(screen) ? (
        <LiveInquiries key={screen} view={screen} />
      ) : (
        <ClientJourney key={screen} slug={screen} />
      )}
    </Suspense>
  );
}
