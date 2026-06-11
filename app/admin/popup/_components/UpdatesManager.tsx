/**
 * UpdatesManager — 자동 수집 업데이트 현황 (announcement-popup §4 하단).
 *
 * 배포 시 append-updates 가 쌓은 행을 보정: title_user 인라인 수정,
 * milestone 라벨, visible 토글 → PATCH /api/admin/announcements (pr 키,
 * 전달 필드 셀만 타격). 저장 시 수강생 캐시 무효화 → 팝업 즉시 반영.
 */
"use client";

import { useState } from "react";
import type { UpdateItem } from "@/types";

export default function UpdatesManager({ initialUpdates }: { initialUpdates: UpdateItem[] }) {
  const [rows, setRows] = useState(initialUpdates);
  const [busyPr, setBusyPr] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const edit = (pr: number, p: Partial<UpdateItem>) =>
    setRows((rs) => rs.map((r) => (r.pr === pr ? { ...r, ...p } : r)));

  async function save(row: UpdateItem) {
    setBusyPr(row.pr);
    setMsg("");
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pr: row.pr,
          titleUser: row.titleUser,
          milestone: row.milestone,
          visible: row.visible,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `저장 ${res.status}`);
      setMsg(`#${row.pr} 저장했어요.`);
    } catch (e) {
      setMsg(`#${row.pr} 저장 실패: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusyPr(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-black text-gray-900">업데이트 현황</h2>
      <p className="mb-3 text-xs text-gray-400">
        배포할 때마다 자동으로 쌓여요. 문구를 수강생이 읽기 쉽게 다듬고, 보여줄지 정하세요.
      </p>

      <ul className="divide-y divide-gray-50">
        {rows.map((u) => (
          <li key={u.pr} className="flex flex-wrap items-center gap-2 py-2">
            <span className="w-12 shrink-0 text-xs font-bold text-gray-400">#{u.pr}</span>
            <span className="w-20 shrink-0 text-xs text-gray-400">{u.date}</span>
            <span
              className={`w-12 shrink-0 rounded-full px-1.5 py-0.5 text-center text-xs font-bold ${
                u.type === "feat" || u.type === "fix"
                  ? "bg-red-50 text-brand-red"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {u.type || "-"}
            </span>
            <input
              className="h-9 min-w-40 flex-1 rounded-lg border border-gray-200 px-2 text-sm text-gray-900 focus:border-red-300 focus:outline-none"
              value={u.titleUser}
              onChange={(e) => edit(u.pr, { titleUser: e.target.value })}
              placeholder="수강생이 읽는 한 줄"
            />
            <input
              className="h-9 w-32 rounded-lg border border-gray-200 px-2 text-xs text-gray-700 placeholder:text-gray-300 focus:border-red-300 focus:outline-none"
              value={u.milestone}
              onChange={(e) => edit(u.pr, { milestone: e.target.value })}
              placeholder="마일스톤 라벨"
            />
            <label className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={u.visible}
                onChange={(e) => edit(u.pr, { visible: e.target.checked })}
              />
              노출
            </label>
            <button
              type="button"
              disabled={busyPr === u.pr}
              onClick={() => void save(u)}
              className="shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {busyPr === u.pr ? "저장 중…" : "저장"}
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          아직 수집된 업데이트가 없어요. 다음 배포부터 자동으로 쌓여요.
        </p>
      )}
      {msg && <p className="mt-2 text-xs font-semibold text-gray-500">{msg}</p>}
    </section>
  );
}
