import { Suspense } from "react";
import { BrandLoading } from "@/components/common/brand-loading";
import { LiveComplaints } from "@/components/features/complaints/live";
export const metadata = {
  title: "Report a listing | Kof’a",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<BrandLoading />}>
      <LiveComplaints publicReport />
    </Suspense>
  );
}
