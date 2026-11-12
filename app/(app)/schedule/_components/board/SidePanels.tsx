"use client";
/**
 * 주간 보드 왼쪽 판 — 이번 주 미팅 결과 · 주간 이슈(트레이닝 목표 판은 BoardGoals.tsx). 각 판은 제목 줄을 눌러 접고 편다.
 */
import { useState, type ReactNode } from "react";
import type { Meeting, MeetingState, ScheduleIssue } from "@/types";
import { needsResult } from "../../_lib/board";
import { dayLabelKO, parseISO } from "../../_lib/week";
import { CH_DOT, ST_BAR } from "./board-style";

const STATES: MeetingState[] = ["예약", "계약", "완료", "변경", "취소"];
const ST_TEXT: Record<MeetingState, string> = { 예약: "text-amber-700", 계약: "text-green-700", 완료: "text-orange-700", 변경: "text-purple-700", 취소: "text-red-700" };

export function Panel({ title, icon, summary, closedSummary, defaultOpen = true, tone = "", children }: {
  /** closedSummary = 접혀 있을 때만 보이는 요약(시안: 트레이닝 목표 「정량 2/5 · 과제 3」). */
  title: string; icon: ReactNode; summary?: ReactNode; closedSummary?: ReactNode; defaultOpen?: boolean; tone?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`min-h-0 ${tone}`}>
      <h2>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm font-extrabold text-slate-900 hover:bg-slate-900/[0.03]">
          <span className="text-violet-700 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{title}
          <span className="ml-auto text-px-11 font-bold tabular-nums text-slate-500">{open ? summary : closedSummary ?? summary}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </h2>
      {open && <div className="px-3.5 pb-3.5">{children}</div>}
    </section>
  );
}

const ico = (d: string) => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export function ResultPanel({ meetings, now, onPending }: { meetings: Meeting[]; now: Date; onPending: (m: Meeting) => void }) {
  const counts = Object.fromEntries(STATES.map((s) => [s, meetings.filter((m) => m.상태 === s).length])) as Record<MeetingState, number>;
  const pending = meetings.filter((m) => needsResult(m, now)).sort((a, b) => (a.미팅날짜 + a.미팅시간).localeCompare(b.미팅날짜 + b.미팅시간));
  return (
    <Panel title="이번 주 미팅 결과" icon={ico("M3 3v18h18M7 15l4-4 3 3 5-6")} summary={`${meetings.length}건${pending.length ? ` · 대기 ${pending.length}건` : ""}`}>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-200">
        {STATES.filter((s) => counts[s]).map((s) => <span key={s} className={ST_BAR[s]} style={{ flex: counts[s] }} title={`${s} ${counts[s]}`} />)}
      </div>
      <div className="mt-2.5 grid grid-cols-5 text-center">
        {STATES.map((s) => <div key={s} className="text-px-11 text-slate-500"><b className={`block text-base font-extrabold tabular-nums ${counts[s] ? ST_TEXT[s] : "text-slate-300"}`}>{counts[s]}</b>{s}</div>)}
      </div>
      {pending.length > 0 ? (
        <div className="mt-3" aria-live="polite">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-amber-800">결과 입력 대기 <b>{pending.length}건</b></p>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
            {pending.map((m) => (
              <li key={m.id} className="min-w-0">
                <button type="button" onClick={() => onPending(m)} className="flex h-9 w-full items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-2 text-left hover:bg-amber-100">
                  <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${CH_DOT[m.channel]}`} />
                  <span className="min-w-0 flex-1 truncate text-px-13 font-bold text-slate-900">{m.업체명}</span>
                  <span className="shrink-0 text-px-11 tabular-nums text-slate-500">{dayLabelKO(parseISO(m.미팅날짜))} {m.미팅시간}</span>
                  <span className="shrink-0 text-px-11 font-extrabold text-amber-800">입력</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : meetings.some((m) => m.상태 !== "예약") ? <p className="mt-3 text-xs font-bold text-green-700">✓ 지난 미팅 결과를 모두 입력했어요</p> : null}
    </Panel>
  );
}

export function IssuesPanel({ issues, ready, onChange }: { issues: ScheduleIssue[]; ready: boolean; onChange: (next: ScheduleIssue[]) => void }) {
  const [text, setText] = useState("");
  const [urgent, setUrgent] = useState(false);
  const open = issues.filter((i) => !i.done).length;
  // 미해결 → 급함 먼저 → 보통, 해결은 맨 아래.
  const sorted = [...issues].sort((a, b) => Number(a.done) - Number(b.done) || Number(b.urgent) - Number(a.urgent));
  const set = (id: string, patch: Partial<ScheduleIssue>) => onChange(issues.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const add = () => {
    if (!text.trim()) return;
    onChange([...issues, { id: `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: text.trim().slice(0, 300), urgent, done: false }]);
    setText("");
    setUrgent(false);
  };
  return (
    <Panel title="주간 이슈" tone="bg-red-500/[0.03]" icon={ico("M15 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8zM15 3v5h5M8 13h8M8 17h5")} summary={`미해결 ${open}`}>
      {!ready && <p className="mb-2 text-xs text-slate-500">이슈 저장소 준비 중이라 지금은 볼 수만 있어요.</p>}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
        {sorted.map((i) => (
          <li key={i.id} className="group flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-red-500/[0.05]">
            <button type="button" role="checkbox" aria-checked={i.done} disabled={!ready} onClick={() => set(i.id, { done: !i.done })} aria-label={`${i.text} ${i.done ? "해결 취소" : "해결"}`}
              className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] ${i.done ? "border-green-600 bg-green-600 text-white" : "border-red-300"}`}>
              {i.done && <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
            </button>
            <span className={`min-w-0 flex-1 text-px-13 leading-snug ${i.done ? "text-slate-400" : "text-slate-800"}`}>{i.text}</span>
            {i.done ? <span className="shrink-0 rounded-md bg-green-50 px-1.5 text-px-11 font-bold text-green-700">해결</span> : (
              <button type="button" disabled={!ready} onClick={() => set(i.id, { urgent: !i.urgent })} title={`눌러서 ${i.urgent ? "보통" : "급함"}으로`}
                className={`shrink-0 rounded-md px-1.5 text-px-11 font-bold ${i.urgent ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{i.urgent ? "급함" : "보통"}</button>
            )}
            <button type="button" disabled={!ready} onClick={() => onChange(issues.filter((x) => x.id !== i.id))} aria-label={`${i.text} 지우기`} className="shrink-0 rounded px-1 text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100">×</button>
          </li>
        ))}
      </ul>
      <form className="mt-1.5 flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-2 focus-within:border-solid focus-within:border-red-400"
        onSubmit={(e) => { e.preventDefault(); add(); }}>
        <span aria-hidden="true" className="text-red-700">＋</span>
        <input value={text} disabled={!ready} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="이슈 추가 후 Enter" aria-label="이슈 추가" className="min-w-0 flex-1 bg-transparent text-px-13 outline-none" />
        <button type="button" disabled={!ready} aria-pressed={urgent} onClick={() => setUrgent((v) => !v)} title="급한 이슈로 추가"
          className={`shrink-0 rounded-md px-1.5 text-px-11 font-bold ${urgent ? "bg-red-50 text-red-700" : "border border-dashed border-red-200 text-slate-400"}`}>급함</button>
      </form>
    </Panel>
  );
}
