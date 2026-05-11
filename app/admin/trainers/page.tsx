/**
 * /admin/trainers — Admin 전용 트레이너 관리.
 *
 * 두 섹션:
 *   1. 트레이너 요청 관리 — status=pending 목록 → 승인 / 거절
 *   2. 트레이너 담당 부여 — trainee 목록 + 각 trainee 의 assignedTrainer 변경 셀렉터
 */
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import {
  listPendingTrainers,
  listAllUsers,
} from "@/repo/users";
import TrainerMgmtPanel from "@/components/auth/TrainerMgmtPanel";

// 승인·배정 액션 직후 즉시 반영을 위해 강제 동적 렌더.
export const dynamic = "force-dynamic";

export default async function AdminTrainersPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !isAdminEmail(sessionEmail)) redirect("/");

  const [pending, all] = await Promise.all([
    listPendingTrainers(),
    listAllUsers(),
  ]);
  const trainers = all.filter((u) => u.role === "trainer" && u.status === "active");
  const trainees = all.filter((u) => u.role === "trainee");

  return (
    <TrainerMgmtPanel
      sessionEmail={sessionEmail}
      pendingTrainers={pending}
      activeTrainers={trainers}
      trainees={trainees}
    />
  );
}
