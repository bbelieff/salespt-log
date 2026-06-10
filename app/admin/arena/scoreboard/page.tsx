/**
 * /admin/arena/scoreboard — Admin 전용 아레나 전광판 (매주 캡쳐 공지용).
 *
 * 기수별(A1-N) 입금자 평균: 생산/유입/컨택/미팅/계약 (주차 1~8 + 총합).
 * 모수 = 입금자만(Q memo "입금"), 부부 1시트=1명. 30분 캐시 + 수동 새로고침.
 * (수강생·회장 미노출 — admin 가드. §6)
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, canViewAdminPages } from "@/auth/identity";
import { loadScoreboard, METRICS } from "@/service/scoreboard";
import { normalizeArenaCohort } from "@/repo/users-arena";
import ScoreboardRefreshButton from "@/components/auth/ScoreboardRefreshButton";

export const dynamic = "force-dynamic";

export default async function ScoreboardPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) redirect("/");

  const { byCohort } = await loadScoreboard();

  return (
    <main className="mx-auto min-h-dvh max-w-5xl bg-white px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-gray-900">아레나 전광판</h1>
          <p className="text-xs text-gray-500">
            기수별 입금자 평균 (주차 1~8 + 총합) · 부부 1시트=1명
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScoreboardRefreshButton />
          <Link
            href="/admin/arena"
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            ← 아레나 관리
          </Link>
        </div>
      </div>

      {byCohort.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-400">
          아레나 참가자가 없습니다.
        </div>
      )}

      <div className="space-y-6">
        {byCohort.map((c) => (
          <section key={c.cohort}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-black text-gray-800">
                {normalizeArenaCohort(c.cohort)}기
              </h2>
              <span className="text-[11px] text-gray-500">
                입금자 {c.paidMembers}명
              </span>
            </div>
            {c.paidMembers === 0 ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-400">
                입금자 없음 (N/A)
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full min-w-[640px] border-collapse text-center text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-2 py-1.5 text-left font-bold">지표</th>
                      {c.weekly.map((w) => (
                        <th key={w.week} className="px-2 py-1.5 font-bold">
                          {w.week}주
                        </th>
                      ))}
                      <th className="px-2 py-1.5 font-black text-gray-700">
                        총합
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((m) => (
                      <tr key={m} className="border-t border-gray-50">
                        <td className="px-2 py-1.5 text-left font-bold text-gray-700">
                          {m}
                        </td>
                        {c.weekly.map((w) => (
                          <td
                            key={w.week}
                            className="px-2 py-1.5 tabular-nums text-gray-800"
                          >
                            {w[m].toFixed(1)}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 font-black tabular-nums text-gray-900">
                          {c.total[m].toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
