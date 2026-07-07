/**
 * /admin/db-parity?cohort=8 — DB 파일럿 대조 표 (마스터 전용, db-migration-pilot §3).
 * 기수·탭별 "시트 유효 행수 vs DB 행수". 온디맨드 무거움 — 필요할 때만 연다.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail, isAdminEmail } from "@/auth/identity";
import { getDbParity } from "@/service/db-parity";

export const dynamic = "force-dynamic";

export default async function DbParityPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const email = await getSessionEmail();
  if (!email || !isAdminEmail(email)) redirect("/");
  const { cohort = "8" } = await searchParams;
  const parity = await getDbParity(cohort);

  return (
    <main className="min-h-dvh bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-black text-gray-900">
          🗄️ DB 파일럿 대조 — {cohort}기
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          시트 유효 행수(키 열 기준) vs Supabase sheet_rows(_cleared 제외). 대상 시트{" "}
          {parity.users}개. 다른 기수: URL 에 ?cohort=9 처럼 지정.
        </p>
        {!parity.enabled && (
          <p className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500">
            DATABASE_URL 미설정 — DB 행수는 비교 불가(시트 행수만 표시).
          </p>
        )}
        <table className="mt-4 w-full rounded-2xl border border-gray-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="px-4 py-2">탭</th>
              <th className="px-4 py-2 text-right">시트</th>
              <th className="px-4 py-2 text-right">DB</th>
              <th className="px-4 py-2 text-right">차이</th>
            </tr>
          </thead>
          <tbody>
            {parity.rows.map((r) => {
              const diff = r.dbCount === null ? null : r.dbCount - r.sheetCount;
              return (
                <tr key={r.tab} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-800">{r.tab}</td>
                  <td className="px-4 py-2 text-right">{r.sheetCount}</td>
                  <td className="px-4 py-2 text-right">{r.dbCount ?? "—"}</td>
                  <td
                    className={`px-4 py-2 text-right font-bold ${
                      diff === null
                        ? "text-gray-300"
                        : diff === 0
                          ? "text-emerald-600"
                          : "text-red-600"
                    }`}
                  >
                    {diff === null ? "—" : diff === 0 ? "일치" : diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-gray-400">
          ※ dual-write 는 배포 후 쓰기부터 쌓임 — backfill(Actions → DB Backfill) 전에는
          DB 쪽이 적은 게 정상. <Link href="/admin" className="underline">← 마스터 메뉴</Link>
        </p>
      </div>
    </main>
  );
}
