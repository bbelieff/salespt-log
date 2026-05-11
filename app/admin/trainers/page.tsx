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

  // 활성 트레이너 풀:
  //   - role==="trainer" + status==="active"  (정식 트레이너)
  //   - email ∈ ADMIN_EMAILS                  (마스터 본인 — 트레이너처럼 담당 받음)
  const adminLc = new Set(adminEmails());
  const activeAll = all.filter((u) => {
    if (u.role === "trainer" && u.status === "active") return true;
    if (adminLc.has(u.email.toLowerCase())) return true;
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
