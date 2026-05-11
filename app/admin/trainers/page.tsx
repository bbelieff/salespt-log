/**
 * /admin/trainers — Admin 전용 트레이너 관리.
 *
 * 섹션 순서:
 *   1. 트레이너 요청관리 — status=pending 승인/거절
 *   2. 트레이너 담당부여 — 트레이너 카드 + 수강생 다중 체크박스
 *   3. 수강생 명단      — 기수별 아코디언
 *   4. 관리부서 명단    — B 컬럼="관리" 인원
 */
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { adminEmails } from "@/config";
import { listPendingTrainers, listAllUsers } from "@/repo/users";
import TrainerMgmtPanel from "@/components/auth/TrainerMgmtPanel";

export const revalidate = 30;

export default async function AdminTrainersPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) redirect("/");

  const [pending, all] = await Promise.all([
    listPendingTrainers(),
    listAllUsers(),
  ]);

  // ADMIN_EMAILS 중 registry row 가 없는 경우는 가짜 row 합성 — 사용자가 명단
  // 에서 본인을 못 보는 경우 방지 (이전: leadbzcenter, xorud910115 등 미등록).
  const adminLc = adminEmails(); // 이미 lowercase
  const allEmailsLc = new Set(all.map((u) => u.email.toLowerCase()));
  const synthAdmins = adminLc
    .filter((e) => !allEmailsLc.has(e))
    .map((e) => ({
      email: e,
      cohort: "",
      name: e.split("@")[0] || e,
      spreadsheetId: "",
      role: "admin" as const,
      status: "active" as const,
      assignedTrainer: "",
    }));
  const fullList = [...all, ...synthAdmins];

  // 활성 트레이너 풀:
  //   - role==="trainer" + status==="active"  (정식 트레이너)
  //   - email ∈ ADMIN_EMAILS                  (마스터 본인 — 트레이너처럼 담당 받음)
  const adminSet = new Set(adminLc);
  const activeAll = fullList.filter((u) => {
    if (u.role === "trainer" && u.status === "active") return true;
    if (adminSet.has(u.email.toLowerCase())) return true;
    return false;
  });

  // B 컬럼="관리" 면 관리부서, 그 외(T/빈/숫자)는 일반 트레이너.
  const isManagement = (u: { cohort: string }) => u.cohort.trim() === "관리";
  const activeTrainers = activeAll.filter((u) => !isManagement(u));
  const managementStaff = activeAll.filter(isManagement);
  const trainees = all.filter((u) => u.role === "trainee");

  return (
    <TrainerMgmtPanel
      sessionEmail={sessionEmail}
      pendingTrainers={pending}
      activeTrainers={activeTrainers}
      managementStaff={managementStaff}
      trainees={trainees}
    />
  );
}
