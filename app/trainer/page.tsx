/**
 * /trainer — 트레이너 랜딩.
 * 본인 정보 + 마스터 시트 링크 + 담당 수강생 목록 (impersonation 진입점).
 *
 * **force-dynamic**: admin 이 /admin/trainers 에서 담당 배정 직후 트레이너가
 * 이 페이지를 열면 즉시 반영되어야 함. registry 캐시(60s)는 unstable_cache 가
 * 관리하지만, 페이지 레벨 RSC 캐시 때문에 안 보이는 케이스 방지.
 */
import { redirect } from "next/navigation";
import { getSessionEmail, getEffectiveRole, isAdminEmail } from "@/auth/identity";
import { findUserByEmail, listTraineesForTrainer } from "@/repo/users";
import { enrichUsersWithSheetCohort } from "@/service";
import { cohortMasterSheetId } from "@/config";
import TrainerLanding from "@/components/auth/TrainerLanding";
import LogoutButton from "@/components/auth/LogoutButton";

export const dynamic = "force-dynamic";

export default async function TrainerPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) redirect("/");

  const { role, status } = await getEffectiveRole(sessionEmail);

  if (role === "admin") redirect("/admin");
  if (role !== "trainer") redirect("/");
  if (status === "pending") {
    return (
      <main className="min-h-dvh bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-black text-gray-900 mb-2">승인 대기 중</h1>
          <p className="text-sm text-gray-500">
            관리자 승인 후 담당 수강생을 조회할 수 있습니다.
          </p>
          <div className="mt-6">
            <LogoutButton
              className="text-sm text-gray-700 underline-offset-2 hover:underline"
              label="로그아웃"
            />
          </div>
        </div>
      </main>
    );
  }

  const trainer = await findUserByEmail(sessionEmail);
  const traineesRegistry = await listTraineesForTrainer(sessionEmail);
  // 표시 라벨 SSOT: 각 수강생 개인 시트 B3 (cohort). registry 값은 fallback.
  const trainees = await enrichUsersWithSheetCohort(traineesRegistry);
  // 기수 전체 현황 마스터 시트 — env SHEETS_COHORT_MASTER_ID 기반.
  // registry 시트(email→spreadsheetId 매핑)와는 별개 SSOT.
  const masterId = cohortMasterSheetId();
  const masterSheetUrl = masterId
    ? `https://docs.google.com/spreadsheets/d/${masterId}/edit`
    : "";

  return (
    <TrainerLanding
      sessionEmail={sessionEmail}
      trainerName={trainer?.name ?? sessionEmail}
      trainees={trainees}
      masterSheetUrl={masterSheetUrl}
      isAdmin={isAdminEmail(sessionEmail)}
    />
  );
}
