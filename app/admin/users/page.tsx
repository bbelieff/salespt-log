/**
 * /admin/users — Admin 사용자 선택 (impersonation 진입점).
 *
 * 기존 /admin 의 기능을 이 경로로 이동 — /admin 은 두 분기 랜딩이 됨 (PR ε).
 */
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listAllUsers } from "@/repo/users";
import { enrichUsersWithSheetCohort } from "@/service";
import AdminUserPicker from "@/components/auth/AdminUserPicker";

export default async function AdminUsersPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) {
    redirect("/");
  }
  const registryUsers = await listAllUsers();
  // 표시 라벨 SSOT: 각 사용자 개인 시트 B3 (cohort). registry 값은 fallback (PR β).
  const users = await enrichUsersWithSheetCohort(registryUsers);
  return <AdminUserPicker users={users} sessionEmail={sessionEmail} />;
}
