/**
 * /trainer — 트레이너 랜딩.
 * 본인 정보 + 마스터 시트 링크 + 담당 수강생 목록 (impersonation 진입점).
 *
 * **force-dynamic**: admin 이 /admin/trainers 에서 담당 배정 직후 트레이너가
 * 이 페이지를 열면 즉시 반영되어야 함. registry 캐시(60s)는 unstable_cache 가
 * 관리하지만, 페이지 레벨 RSC 캐시 때문에 안 보이는 케이스 방지.
 */
import { redirect } from "next/navigation";
import {
  getSessionEmail,
  getEffectiveRole,
  canViewAdminPages,
} from "@/auth/identity";
import { findUserByEmail, listTraineesForTrainer } from "@/repo/users";
import { enrichUsersWithSheetCohort } from "@/service";
import { cohortMasterSheetId } from "@/config";
import TrainerLanding from "@/components/auth/TrainerLanding";
import PendingApprovalScreen from "@/components/auth/PendingApprovalScreen";

export const dynamic = "force-dynamic";

export default async function TrainerPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) redirect("/");

  const { role, status } = await getEffectiveRole(sessionEmail);

  // admin 도 트레이너 페이지 열람 가능 (마스터 메뉴에서 "트레이너 페이지" 선택 시).
  // admin 은 본인이 담당 trainee 가 없을 수 있어 빈 목록 보일 수 있음 — 정상.
  const isAdmin = role === "admin";
  if (!isAdmin && role !== "trainer") redirect("/");
  if (!isAdmin && status === "pending") {
    return (
      <PendingApprovalScreen subtitle="관리자 승인 후 담당 수강생을 조회할 수 있습니다." />
    );
  }

  const trainer = await findUserByEmail(sessionEmail);
  // admin 이면 본인 email 로 담당 trainee 검색 (보통 없음 — 또는 admin email 을
  // 일부러 assignedTrainer 로 지정한 경우만 표시).
  const traineesRegistry = await listTraineesForTrainer(sessionEmail);
  // 표시 라벨 SSOT: 각 수강생 개인 시트 B3 (cohort). registry 값은 fallback.
  const trainees = await enrichUsersWithSheetCohort(traineesRegistry);
  // 기수 전체 현황 마스터 시트 — env SHEETS_COHORT_MASTER_ID 기반.
  // registry 시트(email→spreadsheetId 매핑)와는 별개 SSOT.
  const masterId = cohortMasterSheetId();
  const masterSheetUrl = masterId
    ? `https://docs.google.com/spreadsheets/d/${masterId}/edit`
    : "";

  // 관리자(admin) 또는 관리부서(management) 면 마스터 메뉴 진입 가능.
  // 기존엔 isAdminEmail 만 체크해서 관리부서/일관성 깨짐 → canViewAdminPages 로 통일.
  const canBackToAdmin = await canViewAdminPages(sessionEmail);

  return (
    <TrainerLanding
      sessionEmail={sessionEmail}
      trainerName={trainer?.name ?? sessionEmail}
      trainees={trainees}
      masterSheetUrl={masterSheetUrl}
      canBackToAdmin={canBackToAdmin}
    />
  );
}
