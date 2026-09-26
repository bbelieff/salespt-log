"use client";

import { useState } from "react";
import type { Todo, TodoRecordKind, TodoType } from "@/types";
import { usePatchTodo, useRemoveTodo } from "@/query/todos-hooks";
import { useFocusScroll } from "@/lib/hooks/useFocusScroll";
import TodoFormModal, { type TodoDraftSeed } from "./TodoFormModal";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 9).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];
const TYPE_BADGE: Record<TodoType, string> = { 미팅: "bg-blue-100 text-blue-700", 전화: "bg-green-100 text-green-700", 메시지: "bg-violet-100 text-violet-700", 기타: "bg-gray-100 text-gray-600", 일반: "bg-teal-100 text-teal-700" };
const todayISO = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

interface Props {
  contractRef: string;
  institutionRef: string;
  draftInstitution?: string;
  companyName: string;
  todos: Todo[];
  focusId?: string | null;
  onEnsureSaved?: () => void;
}

export default function TodoSection({ contractRef, institutionRef, draftInstitution, companyName, todos, focusId, onEnsureSaved }: Props) {
  const patch = usePatchTodo();
  const remove = useRemoveTodo();
  const [kind, setKind] = useState<TodoRecordKind>("todo");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO);
  const [hour, setHour] = useState("09");
  const [minute, setMinute] = useState("00");
  const [seed, setSeed] = useState<TodoDraftSeed | null>(null);
  const saved = institutionRef.trim();
  const effective = saved || (draftInstitution ?? "").trim();
  const focusActive = !!focusId && todos.some((t) => t.id === focusId);
  const { ref: focusedRef, ring } = useFocusScroll<HTMLDivElement>(focusActive);
  const add = () => {
    if (!effective || !title.trim() || !date) return;
    if (!saved) onEnsureSaved?.();
    setSeed({ 기록종류: kind, 제목: title.trim(), 예정일자: date, hour, minute: hour === "20" ? "00" : minute });
  };
  return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-2.5">
      <div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-bold text-slate-700">Todo 및 History</span><span className="text-[10px] text-slate-400">캘린더 연동</span></div>
      {todos.length > 0 && <div className="mb-2 space-y-1.5">{todos.map((t) => { const history = t.기록종류 === "history"; return <div key={t.id} ref={t.id === focusId ? focusedRef : undefined} className={`flex items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 ${ring && t.id === focusId ? "ring-2 ring-blue-400" : "border-slate-200"}`}>
        {!history && <input type="checkbox" aria-label="완료 토글" checked={t.완료여부} onChange={(e) => patch.mutate({ contractRef, id: t.id, partial: { 완료여부: e.target.checked } })} className="h-4 w-4 accent-blue-600"/>}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${history ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{history ? "History" : "Todo"}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${TYPE_BADGE[t.type]}`}>{t.type}</span>
        <span className={`min-w-0 flex-1 truncate text-xs ${t.완료여부 && !history ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.제목}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-slate-400">{t.예정일자.slice(5).replace("-", "/")} {t.예정시각}</span>
        <button type="button" onClick={() => remove.mutate({ contractRef, id: t.id })} className="text-slate-300 hover:text-red-500" aria-label="기록 삭제">×</button>
      </div>; })}</div>}
      <div className="grid gap-1.5 sm:grid-cols-[auto_minmax(120px,1fr)_128px_132px_44px]">
        <div className="flex rounded-md bg-white p-0.5 ring-1 ring-slate-200">{(["todo", "history"] as TodoRecordKind[]).map((k) => <button type="button" key={k} onClick={() => setKind(k)} className={`h-8 rounded px-2 text-[11px] font-bold ${kind === k ? "bg-slate-900 text-white" : "text-slate-500"}`}>{k === "todo" ? "Todo" : "History"}</button>)}</div>
        <input aria-label="기록 제목" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={effective ? "제목 입력" : "진행기관 입력 필요"} disabled={!effective} className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-100"/>
        <input aria-label="기록 날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-1.5 text-xs"/>
        <div className="grid grid-cols-2 gap-1"><select aria-label="시" value={hour} onChange={(e) => { setHour(e.target.value); if (e.target.value === "20") setMinute("00"); }} className="h-9 rounded-md border border-slate-300 bg-white px-1 text-xs">{HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}</select><select aria-label="분" value={hour === "20" ? "00" : minute} disabled={hour === "20"} onChange={(e) => setMinute(e.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-1 text-xs">{MINUTES.map((m) => <option key={m} value={m}>{m}분</option>)}</select></div>
        <button type="button" onClick={add} disabled={!effective || !title.trim() || !date} className="h-9 rounded-md bg-slate-900 text-xs font-bold text-white disabled:opacity-40">추가</button>
      </div>
      {seed && <TodoFormModal contractRef={contractRef} institutionRef={effective} companyName={companyName} initial={seed} onClose={() => { setSeed(null); setTitle(""); }}/>}`r`n    </div>
  );
}
