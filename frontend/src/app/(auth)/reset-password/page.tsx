import { BrandLoading } from "@/components/common/brand-loading";
import { Suspense } from "react";
import { AuthScreenView } from "@/components/features/auth/auth-screen";
export const metadata = {
  title: "Kof’a — reset password",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<BrandLoading />}>
      <AuthScreenView screen="reset-password" />
    </Suspense>
  );
}
