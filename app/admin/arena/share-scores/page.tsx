/**
 * /admin/arena/share-scores — Admin 전용 공유왕 수동 집계 (arena-scoreboard-v2).
 *
 * 입금 참가자(1시트=1인) + 현재 점수 머지해 props 로. 저장은 클라이언트가
 * POST /api/admin/share-scores. 조회는 여기 서버에서 listShareScoreTargets 직접.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, canViewAdminPages } from "@/auth/identity";
import { listShareScoreTargets } from "@/service/scoreboard";
import ShareScoresManager from "./_components/ShareScoresManager";

export const dynamic = "force-dynamic";

export default async function ShareScoresPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail || !(await canViewAdminPages(sessionEmail))) redirect("/");

  const targets = await listShareScoreTargets();

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-black text-gray-900">공유왕 집계</h1>
        <Link
          href="/admin/arena"
          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          ← 아레나 관리
        </Link>
      </div>

      <ShareScoresManager initial={targets} />
    </main>
  );
}
