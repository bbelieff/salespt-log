/**
 * /admin/users Tier 1 — <1초 목표 구간 (BBE-249, A 설계서 §① Tier 1).
 *
 * 여기서 하는 일은 전부 **이미 DB, 60초 unstable_cache**(`listDistinctUsers`·
 * `getArchivedCohortSet`·`listPendingTrainees`) + 순수 메모리 합성(관리자 synth row·
 * 트레이너 풀 필터) — 개인 시트를 읽는 호출은 하나도 없다. 그래서 이 함수가
 * resolve 되는 순간(콜드에서도 목표 <1초) "이름·기수·상태" 카드 뼈대가 화면에
 * 뜬다. 8주 누적/funnel 숫자(느릴 수 있음)는 안쪽 Suspense 로 미룬 `UsersStatsFill`
 * (Tier 2)이 채운다 — 그 전까진 `UsersRosterPreview`(읽기전용 카드 뼈대)가 보인다.
 */
import { Suspense } from "react";
import { adminEmails, adminNames } from "@/config";
import {
  listDistinctUsers,
  listPendingTrainees,
  isReservedTrainee,
} from "@/repo/users";
import { getArchivedCohortSet } from "@/repo/cohorts";
import { cohortGroupKey, cohortGroupCompare } from "@/types";
import { type Trainee, type Trainer } from "@/components/auth/AdminUserPickerTypes";
import UsersStatsFill from "./UsersStatsFill";

export default async function UsersRoster({
  sessionEmail,
  viewOnly,
}: {
  sessionEmail: string;
  viewOnly: boolean;
}) {
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
  const reservedTrainees = activeApprovedTrainees.filter(isReservedTrainee);
  const regularTrainees = activeApprovedTrainees.filter(
    (u) => !isReservedTrainee(u),
  );

  // 활성 트레이너 풀 — page.tsx 원본과 동일한 합성·필터 규칙 (2026-05-14 사고 방지분).
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
  const activeTrainers: Trainer[] = fullList.filter((u) => {
    if (isManagement(u)) return false;
    if (u.role === "trainer" && u.status === "active") return true;
    if (adminSet.has(u.email.toLowerCase())) return true;
    return false;
  });
  const archivedLabels = Array.from(archivedSet);

  return (
    <Suspense
      fallback={
        <UsersRosterPreview
          regularTrainees={regularTrainees}
          archivedSet={archivedSet}
          pendingCount={pendingTrainees.length}
          reservedCount={reservedTrainees.length}
          sessionEmail={sessionEmail}
        />
      }
    >
      <UsersStatsFill
        regularTrainees={regularTrainees}
        reservedTrainees={reservedTrainees}
        pendingUsers={pendingTrainees}
        activeTrainers={activeTrainers}
        archivedLabels={archivedLabels}
        sessionEmail={sessionEmail}
        viewOnly={viewOnly}
      />
    </Suspense>
  );
}

/**
 * Tier 1 이 실제로 화면에 그리는 것 — 읽기전용 카드 뼈대(이름·이메일·기수).
 * 버튼·검색·정렬 등 상호작용은 전부 Tier 2 의 완전한 AdminUserPicker 가 담당한다
 * (핸들러가 그쪽에만 있음 — 여긴 순수 표시).
 */
function UsersRosterPreview({
  regularTrainees,
  archivedSet,
  pendingCount,
  reservedCount,
  sessionEmail,
}: {
  regularTrainees: Trainee[];
  archivedSet: Set<string>;
  pendingCount: number;
  reservedCount: number;
  sessionEmail: string;
}) {
  const activeGroups = new Map<string, Trainee[]>();
  for (const u of regularTrainees) {
    const k = cohortGroupKey(u.cohort, u.captainOf);
    if (archivedSet.has(k)) continue;
    const arr = activeGroups.get(k) ?? [];
    arr.push(u);
    activeGroups.set(k, arr);
  }
  const sortedGroups = Array.from(activeGroups.entries()).sort((a, b) =>
    cohortGroupCompare(a[0], b[0]),
  );

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl pc:max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">
              Master · 수강생 관리
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-gray-900">
              {sessionEmail}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl pc:max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          수강생 관리
        </h1>
        <p className="mt-1.5 text-sm text-gray-500">
          기수별 등록된 수강생 ({regularTrainees.length}명)
          {pendingCount > 0 && ` · 승인 대기 ${pendingCount}명`}
          {reservedCount > 0 && ` · 유보 ${reservedCount}명`}
        </p>
        <div className="mt-6 h-11 w-full rounded-xl border border-gray-200 bg-gray-100" />

        <div className="mt-8 space-y-6">
          {sortedGroups.map(([cohort, list]) => (
            <section key={cohort}>
              <h2 className="mb-2 text-sm font-bold text-gray-700">
                {cohort} ({list.length}명)
              </h2>
              <div className="space-y-2">
                {list.map((u) => (
                  <div
                    key={u.email}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-gray-900">
                        {u.name || u.email}
                      </div>
                      <div className="truncate text-xs text-gray-400">
                        {u.email}
                      </div>
                    </div>
                    <div className="shrink-0 animate-pulse text-xs text-gray-300">
                      통계 불러오는 중…
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
