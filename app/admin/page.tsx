/**
 * /admin — Admin 사용자 선택 화면.
 *
 * Admin이 로그인 후 (impersonation 없을 때) 진입.
 * 모든 등록 사용자 목록 → 클릭 → 그 사람으로 보기.
 */
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listAllUsers } from "@/repo/users";
import AdminUserPicker from "@/components/auth/AdminUserPicker";

export default async function AdminPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) {
    redirect("/");
  }
  const users = await listAllUsers();
  return <AdminUserPicker users={users} sessionEmail={sessionEmail} />;
}
