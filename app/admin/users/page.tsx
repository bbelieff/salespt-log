/**
 * /admin/users — 수강생 관리 (Admin 전용).
 *
 * 한 화면에서:
 *   - 등록된 수강생 전체 (기수별 그룹)
 *   - 각자: 이름·이메일·기수·담당 트레이너(이름들)·시작일·종강일
 *   - "시트 열기" 버튼 → impersonation 진입.
 */
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { listAllUsers } from "@/repo/users";
import { getArchivedCohortSet } from "@/repo/cohorts";
import { enrichUsersWithDates } from "@/service";
import AdminUserPicker from "@/components/auth/AdminUserPicker";

export const revalidate = 30;

export default async function AdminUsersPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) {
    redirect("/");
  }
  const [all, archivedSet] = await Promise.all([
    listAllUsers(),
    getArchivedCohortSet(),
  ]);
  const trainees = all.filter((u) => u.role === "trainee");
  const activeTrainers = all.filter(
    (u) => u.role === "trainer" && u.status === "active",
  );
  // 표시 라벨 SSOT: 각 수강생 개인 시트 B3/C3/O1/O2.
  const enriched = await enrichUsersWithDates(trainees);
  // archived 기수 label set 을 client 로 전달 → 별도 collapsed 섹션 렌더.
  const archivedLabels = Array.from(archivedSet);
  return (
    <AdminUserPicker
      users={enriched}
      activeTrainers={activeTrainers}
      sessionEmail={sessionEmail}
      archivedCohorts={archivedLabels}
    />
  );
}
