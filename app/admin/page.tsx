/**
 * /admin — Admin 사용자 선택 화면.
 *
 * Admin이 로그인 후 (impersonation 없을 때) 진입.
 * 모든 등록 사용자 목록 → 클릭 → 그 사람으로 보기.
 */
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listAllUsers } from "@/repo/users";
import { enrichUsersWithSheetCohort } from "@/service";
import AdminUserPicker from "@/components/auth/AdminUserPicker";

export default async function AdminPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) {
    redirect("/");
  }
  const registryUsers = await listAllUsers();
  // 표시 라벨 SSOT: 각 사용자 개인 시트 B3 (cohort). registry 값은 fallback.
  const users = await enrichUsersWithSheetCohort(registryUsers);
  return <AdminUserPicker users={users} sessionEmail={sessionEmail} />;
}
