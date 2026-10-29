import { Suspense } from "react";
import { SubmissionFlow } from "@/components/features/submission/flow";
export const metadata = {
  title: "List your property with Kof’a",
  robots: { index: false, follow: false },
};
export default function Landlord() {
  return (
    <Suspense fallback={<p className="p-5">Loading listing form…</p>}>
      <SubmissionFlow />
    </Suspense>
  );
}
