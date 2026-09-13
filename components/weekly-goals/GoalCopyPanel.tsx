"use client";
import { useEffect, useRef, useState } from "react";
import type { WeeklyGoalView, WeeklyGoalPrivateRecord } from "@/types/weekly-goals";
import { copyGoalText, goalClipboard, goalPivotCells, GOAL_PIVOT_COLUMNS, meetingCells, meetingClipboard, MEETING_COLUMNS } from "./copy";

export default function GoalCopyPanel({ view, internal, dirty, autoCopyToken }: {
  view: WeeklyGoalView; internal?: WeeklyGoalPrivateRecord; dirty: boolean;
  /** Changes once per successful save; the saved content is copied without another click. */
  autoCopyToken?: number;
}) {
  const [cells, setCells] = useState<string[] | null>(null);
  const [fallback, setFallback] = useState("");
  const [status, setStatus] = useState("");
  const pivot = goalPivotCells(view);
  const copied = useRef(autoCopyToken);
  async function copy(plain: string, html?: string) {
    if (dirty) { setStatus("수정한 내용을 먼저 저장해 주세요."); return; }
    const ok = await copyGoalText(plain, html);
    setFallback(ok ? "" : plain);
    setStatus(ok ? "복사됨" : "아래 내용을 선택해 복사해 주세요.");
  }
  useEffect(() => {
    if (autoCopyToken === undefined || autoCopyToken === copied.current) return;
    copied.current = autoCopyToken;
    if (dirty) return;
    const content = goalClipboard(goalPivotCells(view));
    void copyGoalText(content.plain, content.html).then(ok => {
      setFallback(ok ? "" : content.plain);
      setStatus(ok ? "저장하고 클립보드에 복사했어요." : "아래 내용을 선택해 복사해 주세요.");
    });
    // The saved view is read through the same render; re-running on view identity would re-copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCopyToken]);
  return <section className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={dirty} className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm disabled:opacity-50"
        onClick={() => { const c = goalClipboard(pivot); void copy(c.plain, c.html); }}>클립보드 복사</button>
      {internal && <button type="button" disabled={dirty} className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm disabled:opacity-50"
        onClick={() => { setCells(meetingCells(view, internal)); setFallback(""); setStatus(""); }}>회의록 미리보기</button>}
    </div>
    {dirty && <p className="text-sm text-gray-500">저장 후 복사할 수 있어요.</p>}
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-max border-collapse text-left text-xs">
        <caption className="px-3 py-2 text-left text-xs text-gray-500">클립보드에 복사되는 내용</caption>
        <thead><tr className="bg-gray-50">{GOAL_PIVOT_COLUMNS.map(label =>
          <th key={label} className="whitespace-nowrap border-b border-gray-200 px-3 py-2 font-semibold text-gray-600">{label}</th>)}</tr></thead>
        <tbody><tr>{pivot.map((value, i) =>
          <td key={GOAL_PIVOT_COLUMNS[i]} className="whitespace-pre-wrap break-words border-b border-gray-100 px-3 py-2 align-top tabular-nums">{value}</td>)}</tr></tbody>
      </table>
    </div>
    {cells && internal && <div className="space-y-3 rounded-xl border border-gray-200 p-4">
      <h3 className="font-bold">회의록 복사 내용 확인</h3>
      <div className="grid gap-3 pc:grid-cols-2">{MEETING_COLUMNS.map((label, i) =>
        <label key={label} className="block text-sm">{label}
          <textarea aria-label={`회의록 ${label}`} className="mt-1 w-full rounded-lg border border-gray-300 p-2" value={cells[i]} rows={2}
            onChange={e => setCells(prev => prev?.map((s, j) => i === j ? e.target.value : s) ?? null)} />
        </label>)}</div>
      <button type="button" disabled={dirty} className="min-h-11 rounded-xl bg-blue-500 px-4 font-semibold text-white disabled:opacity-50"
        onClick={() => { const content = meetingClipboard(cells); void copy(content.plain, content.html); }}>회의록용 복사</button>
      <button type="button" onClick={() => setCells(null)} className="ml-2 min-h-11 px-4 text-sm">닫기</button>
    </div>}
    <p role="status" className="text-sm">{status}</p>
    {fallback && <textarea aria-label="직접 선택하여 복사" readOnly value={fallback} rows={6} onFocus={e => e.target.select()}
      className="w-full rounded-xl border border-gray-300 p-3 text-sm" />}
  </section>;
}
