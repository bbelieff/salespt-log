/**
 * /admin/arena/scoreboard — Admin 전용 아레나 전광판 (매주 캡쳐 공지용).
 *
 * 기수 평균(주차 1~8) + 개인 지표별 랭킹(미팅·계약·매출·앱사용량·공유왕)을
 * 한 번에 받아(loadScoreboardBundle) ScoreboardView 에 전달. [관리자 대시보드]/
 * [캡쳐 모드] 전환. 모수 = 입금자만, 부부 1시트=1명. 30분 캐시 + 수동 새로고침.
 * (수강생·회장 미노출 — admin 가드. §6)
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, canViewAdminPages } from "@/auth/identity";
import { loadScoreboardBundle } from "@/service/scoreboard";
import ScoreboardRefreshButton from "@/components/auth/ScoreboardRefreshButton";
import ScoreboardView from "@/components/scoreboard/ScoreboardView";

export const dynamic = "force-dynamic";

export default async function ScoreboardPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) redirect("/");

  const bundle = await loadScoreboardBundle();

  return (
    <main className="mx-auto min-h-dvh max-w-5xl bg-white px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-gray-900">아레나 전광판</h1>
          <p className="text-xs text-gray-500">
            기수 종합 + 개인 랭킹 · 부부 1시트=1명 · 매주 캡쳐 공지용
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

      {bundle.byCohort.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-400">
          아레나 참가자가 없습니다.
        </div>
      ) : (
        <ScoreboardView data={bundle} />
      )}
    </main>
  );
}
