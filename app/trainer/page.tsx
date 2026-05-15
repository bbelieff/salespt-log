/**
 * /trainer — 트레이너 랜딩 (수강생 관리의 read-only 권한축소판).
 *
 * **2026-05-15 개편**: 이전 단순 grid 목록(TrainerLanding) → admin/users 와 동일한
 * 기수박스 > 팀박스 > TraineeCard 계층(TrainerCohortView). 트레이너는 전체 명단을
 * 볼 수 있고, **본인 담당에만** [시트]/[웹앱] 버튼이 활성화됨.
 *
 * **force-dynamic**: admin 이 /admin/trainers 에서 담당 배정 직후 트레이너가
 * 이 페이지를 열면 즉시 반영되어야 함. 페이지 레벨 RSC 캐시 회피.
 */
import { redirect } from "next/navigation";
import {
  getSessionEmail,
  getEffectiveRole,
  canViewAdminPages,
  isAdminEmail,
} from "@/auth/identity";
import { adminEmails, adminNames, cohortMasterSheetId } from "@/config";
import {
  findUserByEmail,
  listAllUsers,
  isReservedTrainee,
} from "@/repo/users";
import { getArchivedCohortSet } from "@/repo/cohorts";
import { enrichUsersWithDates } from "@/service";
import TrainerCohortView from "@/components/auth/TrainerCohortView";
import PendingApprovalScreen from "@/components/auth/PendingApprovalScreen";

export const dynamic = "force-dynamic";

export default async function TrainerPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) redirect("/");

  const { role, status } = await getEffectiveRole(sessionEmail);

  // admin 도 트레이너 페이지 열람 가능 (마스터 메뉴 → "트레이너 페이지").
  const isAdmin = role === "admin";
  if (!isAdmin && role !== "trainer") redirect("/");
  if (!isAdmin && status === "pending") {
    return (
      <PendingApprovalScreen subtitle="관리자 승인 후 담당 수강생을 조회할 수 있습니다." />
    );
  }

  const trainer = await findUserByEmail(sessionEmail);

  // 전체 수강생 명단 — admin/users 와 동일한 활성/보관 분리.
  // 유보(reserved) 와 pending 은 트레이너에게 안 보임 (admin 영역).
  const [all, archivedSet] = await Promise.all([
    listAllUsers(),
    getArchivedCohortSet(),
  ]);
  const activeApprovedTrainees = all.filter(
    (u) => u.role === "trainee" && u.status === "active",
  );
  const regularTrainees = activeApprovedTrainees.filter(
    (u) => !isReservedTrainee(u),
  );
  const enriched = await enrichUsersWithDates(regularTrainees);

  // activeTrainers — /admin/users 와 동일 합성·필터 규칙:
  //   (1) ADMIN_EMAILS 멤버 중 registry row 없는 사람은 synth admin row 합성.
  //   (2) registry trainer + status=active OR ADMIN_EMAILS 멤버.
  //   (3) 관리부서(cohort="관리") 는 트레이너 풀에서 제외.
  // 트레이너 페이지에서는 dropdown 안 쓰지만 nameByEmail (담당 표시) lookup 용.
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

  // 기수 전체 현황 마스터 시트 — env SHEETS_COHORT_MASTER_ID.
  const masterId = cohortMasterSheetId();
  const masterSheetUrl = masterId
    ? `https://docs.google.com/spreadsheets/d/${masterId}/edit`
    : "";

  // 관리자(admin) 또는 관리부서(management) 면 마스터 메뉴 진입 가능.
  const canBackToAdmin = await canViewAdminPages(sessionEmail);

  // admin 이름 fallback — ADMIN_NAMES env 매핑 우선.
  const trainerName =
    trainer?.name ||
    (isAdmin && isAdminEmail(sessionEmail)
      ? adminNameMap[sessionEmail.toLowerCase()] ?? sessionEmail
      : sessionEmail);

  const archivedLabels = Array.from(archivedSet);

  return (
    <TrainerCohortView
      sessionEmail={sessionEmail}
      trainerName={trainerName}
      trainees={enriched}
      activeTrainers={activeTrainers}
      masterSheetUrl={masterSheetUrl}
      canBackToAdmin={canBackToAdmin}
      archivedCohorts={archivedLabels}
    />
  );
}
