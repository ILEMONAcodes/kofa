import { Suspense } from "react";
import { AuthScreenView } from "@/components/features/auth/auth-screen";
export default function Account() {
  return (
    <Suspense fallback={<p className="p-5">Loading…</p>}>
      <AuthScreenView screen="account" />
    </Suspense>
  );
}
