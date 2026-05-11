/**
 * /admin/users — 수강생 관리 (Admin 전용).
 *
 * 한 화면에서:
 *   - 등록된 수강생 전체 (기수별 그룹)
 *   - 각자: 이름·이메일·기수·담당 트레이너(이름들)·시작일·종강일
 *   - "시트 열기" 버튼 → impersonation 진입.
 */
import { redirect } from "next/navigation";
import {
  getSessionEmail,
  canViewAdminPages,
  isAdminEmail,
} from "@/auth/identity";
import { listAllUsers } from "@/repo/users";
import { getArchivedCohortSet } from "@/repo/cohorts";
import { enrichUsersWithDates } from "@/service";
import AdminUserPicker from "@/components/auth/AdminUserPicker";

export const revalidate = 30;

export default async function AdminUsersPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) {
    redirect("/");
  }
  // 관리부서 멤버는 read-only.
  const viewOnly = !isAdminEmail(sessionEmail);
  const [all, archivedSet] = await Promise.all([
    listAllUsers(),
    getArchivedCohortSet(),
  ]);
  const trainees = all.filter((u) => u.role === "trainee");
  const activeTrainers = all.filter(
    (u) => u.role === "trainer" && u.status === "active",
  );
  const enriched = await enrichUsersWithDates(trainees);
  const archivedLabels = Array.from(archivedSet);
  return (
    <AdminUserPicker
      users={enriched}
      activeTrainers={activeTrainers}
      sessionEmail={sessionEmail}
      archivedCohorts={archivedLabels}
      viewOnly={viewOnly}
    />
  );
}
