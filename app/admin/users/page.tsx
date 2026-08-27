/**
 * /admin/users — 수강생 관리 (Admin 전용).
 *
 * 한 화면에서:
 *   - **승인 대기 수강생** — status=pending. [승인]/[거절] 버튼.
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
import { adminEmails, adminNames } from "@/config";
import {
  listDistinctUsers,
  listPendingTrainees,
  isReservedTrainee,
} from "@/repo/users";
import { getArchivedCohortSet } from "@/repo/cohorts";
import { enrichUsersWithDates, enrichUsersWithStats } from "@/service";
import AdminUserPicker from "@/components/auth/AdminUserPicker";

// **force-dynamic** — 매 요청마다 fresh registry 데이터.
// 이전엔 revalidate=30 이라 self-claim 직후 admin 이 새로고침해도 옛 데이터가
// 30초간 stuck — "수강생 요청관리 섹션이 안 보인다" 사고 (2026-05-12).
// 비용: Sheets API 호출이 매 진입마다 발생하지만 admin N명 한정이라 무부담.
// 데이터 layer 캐시(unstable_cache 60s)는 그대로 유지 — invalidateRegistry 가 처리.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) {
    redirect("/");
  }
  // 관리부서 멤버는 read-only.
  const viewOnly = !isAdminEmail(sessionEmail);
  const [all, archivedSet, pendingTrainees] = await Promise.all([
    listDistinctUsers(),
    getArchivedCohortSet(),
    listPendingTrainees(),
  ]);
  // 정식 trainee 만 (admin 승인 완료, status=active).
  // pending 은 별도 섹션에서만 처리하므로 정규 그룹에서 제외.
  const activeApprovedTrainees = all.filter(
    (u) => u.role === "trainee" && u.status === "active",
  );
  // 유보 vs 정규 — registry B 컬럼 raw 값으로 분기 (enrich 전).
  // 유보는 개인 시트 B3 SSOT 로 덮어쓰지 않고 sentinel "유보" 유지 → UI 가 별도 섹션 분류.
  const reservedTrainees = activeApprovedTrainees.filter(isReservedTrainee);
  const regularTrainees = activeApprovedTrainees.filter(
    (u) => !isReservedTrainee(u),
  );

  // 활성 트레이너 풀 — /admin/trainers 와 동일한 합성·필터 규칙:
  //   (1) ADMIN_EMAILS 멤버 중 registry row 없는 사람은 synth admin row 합성
  //       (마스터가 본인을 명단·드롭다운에서 못 보는 사고 방지).
  //   (2) registry trainer + status=active OR ADMIN_EMAILS 멤버.
  //   (3) 관리부서(cohort="관리") 는 트레이너 풀에서 제외 — 담당 배정 대상 아님.
  // 이전엔 (2)·(3) 누락. 김믿음(admin) 누락 + 관리부서 잘못 표시 사고 (2026-05-14).
  const adminLc = adminEmails();
  const adminNameMap = adminNames();
  const allEmailsLc = new Set(all.map((u) => u.email.toLowerCase()));
  const synthAdmins = adminLc
    .filter((e) => !allEmailsLc.has(e))
    .map((e) => ({
      email: e,
      cohort: "",
      name: adminNameMap[e] ?? e.split("@")[0] ?? e,
      spreadsheetId: "",
      role: "admin" as const,
      status: "active" as const,
      assignedTrainer: "",
      team: "",
      cohortLabel: "",
      nameLabel: "",
      courseStartISO: "",
      graduationISO: "",
      sortOrder: 0,
    }));
  const adminSet = new Set(adminLc);
  const fullList = [...all, ...synthAdmins].map((u) => {
    const lc = u.email.toLowerCase();
    if (!adminSet.has(lc)) return u;
    const override = adminNameMap[lc];
    return override ? { ...u, name: u.name || override } : u;
  });
  const isManagement = (u: { cohort: string }) => u.cohort.trim() === "관리";
  const activeTrainers = fullList.filter((u) => {
    if (isManagement(u)) return false;
    if (u.role === "trainer" && u.status === "active") return true;
    if (adminSet.has(u.email.toLowerCase())) return true;
    return false;
  });
  const enriched = await enrichUsersWithDates(regularTrainees);
  // 8주 funnel stats (E4/E5/E6) — 카드의 "예정/완료/계약" 표시용.
  // readBundle(profile-bundle-cache.ts) 공유 SWR 캐시(FRESH 10분/GRACE 30분, BBE-249)라
  // enrichUsersWithDates 가 이미 fetch 한 경우 캐시 히트(별도 호출 0회). (2026-08-27 정정 —
  // 옛 unstable_cache/"me-bundle-v2" 세대는 BBE-249 때 이 SWR 로 완전히 교체됨, BBE-242 캐시
  // 조사에서 확인.)
  const withStats = await enrichUsersWithStats(enriched);
  const archivedLabels = Array.from(archivedSet);
  return (
    <AdminUserPicker
      users={withStats}
      reservedUsers={reservedTrainees}
      pendingUsers={pendingTrainees}
      activeTrainers={activeTrainers}
      sessionEmail={sessionEmail}
      archivedCohorts={archivedLabels}
      viewOnly={viewOnly}
    />
  );
}
