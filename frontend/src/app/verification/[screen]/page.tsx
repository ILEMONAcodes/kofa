import { requireReviewRole } from "@/lib/review-server/session";
import { LocalGate } from "@/components/access/local-access";
import { redirect, notFound } from "next/navigation";
import { MediaHelpScreen } from "@/components/features/media-help/screen";
import { verificationScreens } from "@/components/features/verification/model";
export const metadata = {
  title: "Verification and transactions | Kof’a",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { screen } = await params;
  const { id } = await searchParams;
  const suffix = id ? `?id=${encodeURIComponent(id)}` : "";
  await requireReviewRole(
    ["agreement", "completed"].includes(screen)
      ? ["client"]
      : ["staff", "admin"],
    `/verification/${screen}${suffix}`,
  );
  if (!verificationScreens.some((s) => s.slug === screen)) notFound();
  if (!["agreement", "completed"].includes(screen)) {
    redirect(`/staff/property${suffix}`);
  }
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
