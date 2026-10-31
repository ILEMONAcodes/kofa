import { Suspense } from "react";
import { AuthScreenView } from "@/components/features/auth/auth-screen";
import { BrandLoading } from "@/components/common/brand-loading";
export const metadata = {
  title: "Staff sign in",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main id="main-content" className="auth-main">
      <Suspense fallback={<BrandLoading />}>
        <AuthScreenView screen="login" staff />
      </Suspense>
    </main>
  );
}
