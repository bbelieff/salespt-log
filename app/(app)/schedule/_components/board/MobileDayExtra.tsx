"use client";
/**
 * 폰·태블릿(1280px 미만) 날짜 판 아래쪽 — 그날 메모 한 줄 · 종일/시간 실무 투두 · 일반 일정 · 「+ 일정」.
 * 미팅 줄은 기존 DaySection 그대로, 이 칸만 더한다. 투두·일정 창은 아래에서 올라오는 시트(BoardPopover).
 */
import { useEffect, useRef, useState } from "react";
import type { Todo } from "@/types";
import { TodoTypeGlyph } from "./glyphs";

export default function MobileDayExtra({ date, todos, memo, memoReady, onMemo, onTodo, onCreate }: {
  date: string; todos: Todo[]; memo: string; memoReady: boolean;
  onMemo: (date: string, text: string) => void; onTodo: (t: Todo) => void; onCreate: (date: string) => void;
}) {
  const [text, setText] = useState(memo);
  const saved = useRef(memo);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setText(memo); saved.current = memo; }, [memo]);
  const flush = (t: string) => { clearTimeout(timer.current); if (t !== saved.current) { saved.current = t; onMemo(date, t); } };
  const sorted = [...todos].sort((a, b) => (a.예정시각 || "00:00").localeCompare(b.예정시각 || "00:00"));
  return (
    <div className="mt-1 border-t border-slate-100 pt-2">
      <label className="flex items-start gap-1.5 rounded-xl bg-amber-50/70 px-2.5 py-1.5">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-1 h-3.5 w-3.5 shrink-0 text-amber-700" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
        <textarea value={text} disabled={!memoReady} maxLength={2000} rows={1} aria-label={`${date} 메모`}
          onChange={(e) => { const t = e.target.value; setText(t); clearTimeout(timer.current); timer.current = setTimeout(() => flush(t), 800); }}
          onBlur={() => flush(text)}
          className="min-h-[22px] min-w-0 flex-1 resize-none bg-transparent text-base leading-snug text-slate-700 outline-none transition-[height] focus:h-32 disabled:opacity-60" />
      </label>
      {sorted.length > 0 && (
        <ul className="mt-1.5 grid gap-1">
          {sorted.map((t) => (
            <li key={t.id}>
              <button type="button" disabled={t.type === "일반"} onClick={() => onTodo(t)}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-1.5 text-left hover:bg-slate-50 disabled:cursor-default">
                <span className="w-11 shrink-0 text-sm font-extrabold tabular-nums text-slate-700">{t.예정시각 || "종일"}</span>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-white ${t.type === "일반" ? "bg-teal-600" : "bg-slate-700"}`}><TodoTypeGlyph type={t.type} className="h-3.5 w-3.5" /></span>
                <span className={`min-w-0 flex-1 ${t.완료여부 ? "text-slate-400 line-through" : ""}`}>
                  <span className="block truncate text-px-15 font-extrabold text-slate-900">{t.type === "일반" ? t.제목 : t.업체명}</span>
                  {t.type !== "일반" && <span className="block truncate text-xs text-slate-500">{t.제목}{t.result ? ` · ${t.result}` : ""}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => onCreate(date)} className="mt-1.5 inline-flex h-9 items-center gap-1 rounded-xl border border-dashed border-teal-500/60 px-3 text-xs font-bold text-teal-700 hover:bg-teal-50">＋ 일정</button>
    </div>
  );
}
