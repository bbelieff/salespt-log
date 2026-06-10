/**
 * /captain — 기수임원(아레나 회장) 조회 페이지 (읽기 전용).
 *
 * 회장 = registry R(captain_of) 있는 아레나 참가자. 본인은 플레이어(role=trainee)
 * 그대로이며, 추가로 자기 기수(captainOf) 멤버 통계를 **읽기만** 할 수 있다.
 * 가드: captainOf 없으면 redirect("/"). 본인 기수 외 데이터 접근 불가(범위=captainOf).
 * (트레이너 페이지 enrich 재활용. §6/ADR-0014)
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionEmail } from "@/auth/identity";
import { findUserByEmail } from "@/repo/users";
import {
  listArenaCohortMembers,
  normalizeArenaCohort,
} from "@/repo/users-arena";
import { enrichUsersWithDates, enrichUsersWithStats } from "@/service";

export const dynamic = "force-dynamic";

const STAT_LABELS: { key: "미팅예정" | "미팅완료" | "계약"; label: string }[] = [
  { key: "미팅예정", label: "미팅예정" },
  { key: "미팅완료", label: "미팅완료" },
  { key: "계약", label: "계약" },
];

export default async function CaptainPage() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) redirect("/");
  const me = await findUserByEmail(sessionEmail);
  const captainOf = (me?.captainOf ?? "").trim();
  if (!captainOf) redirect("/"); // 회장 아님 → 차단

  const members = await listArenaCohortMembers(captainOf);
  const enriched = await enrichUsersWithDates(members);
  const withStats = await enrichUsersWithStats(enriched);
  // 이름 가나다 정렬.
  withStats.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
  const meLc = sessionEmail.toLowerCase();

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-gray-900">기수임원</h1>
          <p className="text-xs text-gray-500">
            {normalizeArenaCohort(captainOf)}기 멤버 {withStats.length}명 · 조회
            전용
          </p>
        </div>
        <Link
          href="/contact"
          className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          내 화면 →
        </Link>
      </div>

      {withStats.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-400">
          기수 멤버가 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {withStats.map((m, i) => {
            const isMe = m.email.toLowerCase() === meLc;
            const s = m.stats ?? { 미팅예정: 0, 미팅완료: 0, 계약: 0 };
            return (
              <li
                key={`${m.email || m.name}-${i}`}
                className={`rounded-xl border p-3 ${
                  isMe ? "border-brand-red/30 bg-red-50/40" : "border-gray-100"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    {m.name}
                  </span>
                  {isMe && (
                    <span className="rounded-full bg-brand-red px-1.5 py-0.5 text-[10px] font-bold text-white">
                      나
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {STAT_LABELS.map(({ key, label }) => (
                    <div
                      key={key}
                      className="rounded-lg bg-gray-50 px-2 py-1.5 text-center"
                    >
                      <div className="text-[10px] text-gray-400">{label}</div>
                      <div className="text-base font-black text-gray-900">
                        {s[key]}
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
