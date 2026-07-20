/**
 * /admin/cohorts — Admin 전용 기수 관리 (active / archived 토글).
 *
 * registry trainee 들이 사용하는 cohort label 들을 수집 + cohorts 탭 상태와 병합.
 * 시트 탭이 없으면 ensure 로 자동 생성.
 */
import { redirect } from "next/navigation";
import {
  getSessionEmail,
  canViewAdminPages,
  isAdminEmail,
} from "@/auth/identity";
import { listDistinctUsers } from "@/repo/users";
import { listCohorts, ensureCohortsTab, type CohortStatus } from "@/repo/cohorts";
import { countPendingCohortCreates } from "@/repo/db/cohort-pending";
import CohortMgmtPanel from "@/components/auth/CohortMgmtPanel";

export const revalidate = 30;

export default async function AdminCohortsPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) redirect("/");
  const viewOnly = !isAdminEmail(sessionEmail);

  const all = await listDistinctUsers();
  // trainee 들이 사용 중인 cohort label 집합.
  const usedLabels = Array.from(
    new Set(
      all
        .filter((u) => u.role === "trainee" && u.cohort.trim())
        .map((u) => u.cohort.replace(/기\s*$/, "").trim())
        .filter(Boolean),
    ),
  );

  // cohorts 탭 자동 생성 + 시드 (없을 때만).
  await ensureCohortsTab(usedLabels);
  const cohortRows = await listCohorts();

  // 표시: 시트에 있는 row + 시트엔 없지만 trainee 가 쓰는 label (default active) 도 노출.
  const knownLabels = new Set(cohortRows.map((c) => c.label));
  const extra = usedLabels
    .filter((l) => !knownLabels.has(l))
    .map((l) => ({
      label: l,
      status: "active" as CohortStatus,
      note: "",
      type: "cohort" as const,
    }));
  const cohorts = [...cohortRows, ...extra];

  // trainee 수 카운트.
  const traineeCountByLabel = new Map<string, number>();
  for (const u of all) {
    if (u.role !== "trainee") continue;
    const key = u.cohort.replace(/기\s*$/, "").trim();
    traineeCountByLabel.set(key, (traineeCountByLabel.get(key) ?? 0) + 1);
  }

  // 정렬: active 먼저, 그 다음 숫자 desc.
  cohorts.sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return (parseInt(b.label) || 0) - (parseInt(a.label) || 0);
  });

  // R3-5: Drive 복제 실패로 pending 큐에 쌓인 기수-생성 잔량(admin 재시도 버튼용). DB 미설정이면 0.
  const pendingCreateCount = (await countPendingCohortCreates().catch(() => 0)) ?? 0;

  return (
    <CohortMgmtPanel
      sessionEmail={sessionEmail}
      cohorts={cohorts.map((c) => ({
        ...c,
        traineeCount: traineeCountByLabel.get(c.label) ?? 0,
      }))}
      viewOnly={viewOnly}
      pendingCreateCount={pendingCreateCount}
    />
  );
}
