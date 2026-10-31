import { StaffManagement } from "@/components/access/staff-management";
import { requireReviewRole, currentReviewConfig } from "@/lib/review-server/session";
export default async function Page() {
  await requireReviewRole(["admin"], "/admin/users");
  const members = currentReviewConfig()?.accounts.map(({email, role}) => ({email, role})) ?? [];
  return <StaffManagement members={members} />;
}
