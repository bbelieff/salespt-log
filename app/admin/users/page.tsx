/**
 * /admin/users — 수강생 관리 (Admin 전용).
 *
 * 한 화면에서:
 *   - 등록된 수강생 (기수별 그룹) — 활성 + 보관 + **유보**
 *   - 각자: 이름·이메일·기수·담당 트레이너(이름들)·시작일·종강일
 *   - "시트 열기" 버튼 → impersonation 진입.
 *   - "유보" 버튼 → registry B="유보" 설정 → 별도 섹션으로 이동.
 *   - 유보 섹션에서: "복귀" (B="") 또는 "퇴출" (row 물리 삭제).
 *
 * 유보(reserved) 도입 배경:
 *   마스터 본인 계정처럼 명단에서 안 보이게 하고 싶지만 row 자체는 살려두고 싶은
 *   trainee 가 있음 (테스트 계정, 임시 인원 등). "관리" 와 동일한 sentinel 패턴.
 */
import { redirect } from "next/navigation";
import {
  getSessionEmail,
  canViewAdminPages,
  isAdminEmail,
} from "@/auth/identity";
import { listAllUsers, isReservedTrainee } from "@/repo/users";
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
  const allTrainees = all.filter((u) => u.role === "trainee");
  // 유보 vs 정규 — registry B 컬럼 raw 값으로 분기 (enrich 전).
  // 유보는 개인 시트 B3 SSOT 로 덮어쓰지 않고 sentinel "유보" 유지 → UI 가 별도 섹션 분류.
  const reservedTrainees = allTrainees.filter(isReservedTrainee);
  const activeTrainees = allTrainees.filter((u) => !isReservedTrainee(u));

  const activeTrainers = all.filter(
    (u) => u.role === "trainer" && u.status === "active",
  );
  const enriched = await enrichUsersWithDates(activeTrainees);
  const archivedLabels = Array.from(archivedSet);
  return (
    <AdminUserPicker
      users={enriched}
      reservedUsers={reservedTrainees}
      activeTrainers={activeTrainers}
      sessionEmail={sessionEmail}
      archivedCohorts={archivedLabels}
      viewOnly={viewOnly}
    />
  );
}
