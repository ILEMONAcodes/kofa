import { Suspense } from "react";
import { AuthScreenView } from "@/components/features/auth/auth-screen";
export const metadata = {
  title: "Kof’a — forgot password",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<p className="p-5">Loading…</p>}>
      <AuthScreenView screen="forgot-password" />
    </Suspense>
  );
}
