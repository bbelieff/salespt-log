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
import { adminEmails } from "@/config";
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
  // 진짜 수강생만 — 다음은 제외:
  //   · admin email (마스터 본인이 registry 에 role=trainee 로 등록되어 있어도 명단 제외)
  //   · cohort="T" (트레이너 의도 표식, 실제 수강생 아님)
  //   · cohort="관리" (관리부서, role=trainee 일 가능성은 적지만 방어적으로)
  const adminLc = new Set(adminEmails());
  const trainees = all.filter((u) => {
    if (u.role !== "trainee") return false;
    if (adminLc.has(u.email.toLowerCase())) return false;
    const c = u.cohort.trim();
    if (c === "T" || c.toUpperCase() === "T" || c === "관리") return false;
    return true;
  });
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
