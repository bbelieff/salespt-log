/**
 * ShareScoresManager — 공유왕 수동 집계 (arena-scoreboard-v2).
 *
 * 입금 참가자(1시트=1인) 목록에 [−][점수][+] 조절 + 이름/기수 검색.
 * 변경 행만 dirty 추적 → 상단 "변경사항 저장 (N)" 1회 일괄 POST
 * (UpdatesManager bulk 저장 패턴 재사용). 저장 성공 시 기준선 갱신 → dirty 0.
 */
"use client";

import { useMemo, useState } from "react";
import type { ShareScoreTarget } from "@/service/scoreboard";

export default function ShareScoresManager({
  initial,
}: {
  initial: ShareScoreTarget[];
}) {
  const [rows, setRows] = useState(initial);
  const [baseline, setBaseline] = useState(
    () => new Map(initial.map((t) => [t.email, t.points])),
  );
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const setPoints = (email: string, next: number) =>
    setRows((rs) =>
      rs.map((r) =>
        r.email === email ? { ...r, points: Math.max(0, next) } : r,
      ),
    );

  const dirtyRows = rows.filter((r) => baseline.get(r.email) !== r.points);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(k) || r.cohort.toLowerCase().includes(k),
    );
  }, [rows, q]);

  async function saveAll() {
    if (!dirtyRows.length || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/share-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: dirtyRows.map((r) => ({ email: r.email, points: r.points })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `저장 ${res.status}`);
      }
      setBaseline(new Map(rows.map((r) => [r.email, r.points])));
      setMsg(`${dirtyRows.length}명 저장했어요.`);
    } catch (e) {
      setMsg(`저장 실패: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-gray-900">공유왕 점수</h2>
        <button
          type="button"
          disabled={dirtyRows.length === 0 || busy}
          onClick={() => void saveAll()}
          className="shrink-0 rounded-full bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy ? "저장 중…" : `변경사항 저장 (${dirtyRows.length})`}
        </button>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        게시판 성과·도움사례 공유글 1건=1점 기준(가감 자유), 최고점=공유왕.
      </p>

      <input
        className="mb-3 h-9 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-red-300 focus:outline-none"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름·기수 검색"
      />

      <ul className="space-y-1">
        {filtered.map((r) => {
          const dirty = baseline.get(r.email) !== r.points;
          return (
            <li
              key={r.email}
              className={`flex items-center gap-2 rounded-lg border-l-4 py-2 pl-2 pr-2 ${
                dirty ? "border-yellow-400 bg-yellow-50" : "border-transparent"
              }`}
            >
              <span className="w-14 shrink-0 truncate text-[11px] font-bold text-gray-400">
                {r.cohort}기
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                {r.name}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="감점"
                  onClick={() => setPoints(r.email, r.points - 1)}
                  className="h-8 w-8 rounded-full border border-gray-200 text-base font-black text-gray-600 hover:bg-gray-50"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  className="h-8 w-14 rounded-lg border border-gray-200 text-center text-sm font-black tabular-nums text-gray-900 focus:border-red-300 focus:outline-none"
                  value={r.points}
                  onChange={(e) =>
                    setPoints(r.email, Math.round(Number(e.target.value) || 0))
                  }
                />
                <button
                  type="button"
                  aria-label="가점"
                  onClick={() => setPoints(r.email, r.points + 1)}
                  className="h-8 w-8 rounded-full border border-gray-200 text-base font-black text-gray-600 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          입금 참가자가 없어요.
        </p>
      )}
      {filtered.length === 0 && rows.length > 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          검색 결과가 없어요.
        </p>
      )}
      {msg && <p className="mt-2 text-xs font-semibold text-gray-500">{msg}</p>}
    </section>
  );
}
