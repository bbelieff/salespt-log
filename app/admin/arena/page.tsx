/**
 * /admin/arena — Admin 전용 아레나 관리.
 *
 * - 아레나 참가자(cohort A{n}-{m}) 기수별 목록.
 * - 각 참가자 회장 지정/해제 토글 (set-arena-captain). 회장도 플레이어(role 불변).
 * - 회장 = registry R(captain_of) 에 자기 cohort 기록 → "기수임원" 조회 권한.
 * (트레이너 관리 패턴. §6/ADR-0014)
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, canViewAdminPages } from "@/auth/identity";
import {
  listArenaParticipants,
  normalizeArenaCohort,
} from "@/repo/users-arena";
import ArenaCohortBoard, {
  type ArenaSeason,
} from "@/components/auth/ArenaCohortBoard";

export const dynamic = "force-dynamic";

function formatArenaLabel(c: string): string {
  const n = normalizeArenaCohort(c);
  return n ? `${n}기` : c;
}

export default async function AdminArenaPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) redirect("/");

  const participants = await listArenaParticipants();

  // 기수별 그룹화 (정규화 cohort 키).
  const byCohort = new Map<string, typeof participants>();
  for (const u of participants) {
    const key = normalizeArenaCohort(u.cohort);
    const arr = byCohort.get(key) ?? [];
    arr.push(u);
    byCohort.set(key, arr);
  }
  const cohorts = [...byCohort.keys()].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );

  // 시즌(A{n})별로 묶어 컨테이너 박스 + 기수 박스 DnD (arena-admin-dnd §P6).
  const bySeason = new Map<string, ArenaSeason["cohorts"]>();
  for (const c of cohorts) {
    const season = c.split("-")[0] || c;
    const arr = bySeason.get(season) ?? [];
    arr.push({
      key: c,
      label: formatArenaLabel(c),
      members: byCohort.get(c)!.map((u) => ({
        email: u.email,
        name: u.name,
        nameLabel: u.nameLabel,
        captainOf: u.captainOf,
      })),
    });
    bySeason.set(season, arr);
  }
  const seasons: ArenaSeason[] = [...bySeason.entries()].map(
    ([season, list]) => ({ season, cohorts: list }),
  );

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-black text-gray-900">아레나 관리</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/arena/scoreboard"
            className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100"
          >
            전광판 →
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            ← 메뉴
          </Link>
        </div>
      </div>

      <p className="mb-4 text-xs text-gray-500">
        참가자별 회장 지정/해제. 회장은 본인 플레이어 화면 + 자기 기수 멤버
        조회(읽기 전용) 가능. 미클레임 참가자는 클레임 후 지정.
      </p>

      {cohorts.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-400">
          아레나 참가자가 없습니다.
        </div>
      )}

      <ArenaCohortBoard seasons={seasons} />
    </main>
  );
}
