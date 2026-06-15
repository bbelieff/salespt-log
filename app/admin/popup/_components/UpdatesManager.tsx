/**
 * UpdatesManager — 자동 수집 업데이트 현황 (announcement-popup §4 하단).
 *
 * 배포 시 append-updates 가 쌓은 행을 보정: title_user 인라인 수정, milestone 라벨,
 * visible 토글 → PATCH /api/admin/announcements (pr 키, 전달 필드 셀만 타격).
 * P15: 행별 저장 제거 → 로컬 dirty 추적 + 상단 "변경 N건 저장" 일괄(Promise.all).
 * 노출은 토글 스위치, 변경행은 노란 좌측보더+배경. 저장 시 수강생 캐시 무효화.
 */
"use client";

import { useState } from "react";
import type { UpdateItem } from "@/types";

export default function UpdatesManager({ initialUpdates }: { initialUpdates: UpdateItem[] }) {
  const [rows, setRows] = useState(initialUpdates);
  // 저장 기준선(원본) — dirty 판정용. 저장 성공 시 현재값으로 갱신.
  const [baseline, setBaseline] = useState(
    () => new Map(initialUpdates.map((u) => [u.pr, u])),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const edit = (pr: number, p: Partial<UpdateItem>) =>
    setRows((rs) => rs.map((r) => (r.pr === pr ? { ...r, ...p } : r)));

  const isDirty = (r: UpdateItem): boolean => {
    const o = baseline.get(r.pr);
    return (
      !o ||
      o.titleUser !== r.titleUser ||
      o.milestone !== r.milestone ||
      o.visible !== r.visible
    );
  };
  const dirtyRows = rows.filter(isDirty);

  async function saveAll() {
    if (!dirtyRows.length || busy) return;
    setBusy(true);
    setMsg("");
    try {
      await Promise.all(
        dirtyRows.map(async (row) => {
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
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `#${row.pr} 저장 ${res.status}`);
          }
        }),
      );
      setBaseline(new Map(rows.map((u) => [u.pr, u]))); // 기준선 갱신 → dirty 0
      setMsg(`${dirtyRows.length}건 저장했어요.`);
    } catch (e) {
      setMsg(`저장 실패: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-gray-900">업데이트 현황</h2>
        <button
          type="button"
          disabled={dirtyRows.length === 0 || busy}
          onClick={() => void saveAll()}
          className="shrink-0 rounded-full bg-brand-red px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy ? "저장 중…" : `변경 ${dirtyRows.length}건 저장`}
        </button>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        배포할 때마다 자동으로 쌓여요. 문구를 수강생이 읽기 쉽게 다듬고, 보여줄지 정하세요.
      </p>

      {/* 열 헤더 — 본문 컬럼폭과 1:1 정렬(P15-fix). */}
      {rows.length > 0 && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
          <span className="w-10 shrink-0">#</span>
          <span className="w-16 shrink-0">날짜</span>
          <span className="w-10 shrink-0">유형</span>
          <span className="min-w-0 flex-1">내용</span>
          <span className="w-28 shrink-0">마일스톤</span>
          <span className="w-24 shrink-0 text-center">노출</span>
        </div>
      )}

      <ul className="space-y-1">
        {rows.map((u) => {
          const dirty = isDirty(u);
          return (
            <li
              key={u.pr}
              className={`flex items-center gap-2 rounded-lg border-l-4 py-2 pl-2 pr-2 ${
                dirty ? "border-yellow-400 bg-yellow-50" : "border-transparent"
              }`}
            >
              <span className="w-10 shrink-0 text-xs font-bold text-gray-400">#{u.pr}</span>
              <span className="w-16 shrink-0 truncate text-xs text-gray-400">{u.date}</span>
              <span
                className={`w-10 shrink-0 rounded-full px-1 py-0.5 text-center text-[10px] font-bold ${
                  u.type === "feat" || u.type === "fix"
                    ? "bg-red-50 text-brand-red"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {u.type || "-"}
              </span>
              {/* 제목 — flex-1 min-w-0 로 긴 제목이 우측을 밀어내지 않음. */}
              <input
                className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-sm text-gray-900 focus:border-red-300 focus:outline-none"
                value={u.titleUser}
                onChange={(e) => edit(u.pr, { titleUser: e.target.value })}
                placeholder="수강생이 읽는 한 줄"
              />
              {/* 우측 고정폭 묶음 — 절대 줄어들지 않음(shrink-0). */}
              <input
                className="h-9 w-28 shrink-0 rounded-lg border border-gray-200 px-2 text-xs text-gray-700 placeholder:text-gray-300 focus:border-red-300 focus:outline-none"
                value={u.milestone}
                onChange={(e) => edit(u.pr, { milestone: e.target.value })}
                placeholder="마일스톤"
              />
              {/* 노출 상태 라벨(버튼 바깥) + 표준 스위치 — knob 절대좌표 없이
                  inline-flex + transform. 헤더 "노출" w-24 와 1:1 정렬. */}
              <div className="flex w-24 shrink-0 items-center justify-end gap-2">
                <span
                  className={`w-7 text-right text-[11px] font-bold ${
                    u.visible ? "text-brand-red" : "text-gray-400"
                  }`}
                >
                  {u.visible ? "노출" : "숨김"}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={u.visible}
                  aria-label="노출 여부"
                  title={u.visible ? "노출 중 (눌러서 숨김)" : "숨김 (눌러서 노출)"}
                  onClick={() => edit(u.pr, { visible: !u.visible })}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                    u.visible ? "bg-brand-red" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      u.visible ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </li>
          );
        })}
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
