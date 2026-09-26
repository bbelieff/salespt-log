"use client";

import { useState } from "react";
import { newTodoOperationId, useCreateTodo } from "@/query/todos-hooks";
import { useDirtyEntry, useGuardedNav } from "@/components/DirtyGuard";
import type { TodoRecordKind, TodoType } from "@/types";

const TYPES: TodoType[] = ["기타", "미팅", "전화", "메시지"];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 9).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export interface TodoDraftSeed {
  기록종류: TodoRecordKind;
  제목: string;
  예정일자: string;
  hour: string;
  minute: string;
}

interface Props {
  contractRef: string;
  institutionRef: string;
  companyName: string;
  initial: TodoDraftSeed;
  onClose: () => void;
}

export default function TodoFormModal({ contractRef, institutionRef, companyName, initial, onClose }: Props) {
  const create = useCreateTodo();
  const [kind, setKind] = useState<TodoRecordKind>(initial.기록종류);
  const [type, setType] = useState<TodoType>("기타");
  const [title, setTitle] = useState(initial.제목);
  const [date, setDate] = useState(initial.예정일자);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.hour === "20" ? "00" : initial.minute);
  const [detail, setDetail] = useState("");
  const [showOnCalendar, setShowOnCalendar] = useState(true);
  const [error, setError] = useState("");
  const [opId] = useState(newTodoOperationId);

  const doCreate = async () => {
    if (!title.trim()) throw new Error("제목을 입력해주세요.");
    if (!date) throw new Error("날짜를 선택해주세요.");
    await create.mutateAsync({ contractRef, institutionRef, 업체명: companyName, 기록종류: kind, type, 제목: title.trim(), 예정일자: date, 예정시각: `${hour}:${hour === "20" ? "00" : minute}`, 장소: "", 상세: detail.trim(), showOnCalendar, operationId: opId });
    onClose();
  };
  useDirtyEntry(`todo-${contractRef}-${institutionRef}`, true, doCreate, onClose, `${kind === "todo" ? "Todo" : "History"} · ${companyName}`);
  const guardedNav = useGuardedNav();
  const close = () => guardedNav(onClose);
  const selectClass = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none";
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={close}>
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-white/70 bg-white/95 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><div><p className="text-[11px] font-semibold text-blue-600">{institutionRef}</p><h3 className="text-lg font-black text-slate-950">{kind === "todo" ? "할 일" : "한 일"} 상세</h3></div><button type="button" onClick={close} className="p-2 text-slate-400" aria-label="닫기">×</button></div>
        <div className="mb-3 grid grid-cols-2 rounded-lg bg-slate-100 p-1">{(["todo", "history"] as TodoRecordKind[]).map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`h-8 rounded-md text-xs font-bold ${kind === k ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>{k === "todo" ? "Todo · 할 일" : "History · 한 일"}</button>)}</div>
        <div className="mb-3 flex flex-wrap gap-1.5">{TYPES.map((t) => <button key={t} type="button" onClick={() => setType(t)} className={`h-7 rounded-full border px-2.5 text-xs font-semibold ${type === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"}`}>{t}</button>)}</div>
        <label className="mb-3 block text-xs font-semibold text-slate-600">제목<input value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1 ${selectClass}`}/></label>
        <div className="mb-3 grid grid-cols-[1.4fr_.7fr_.7fr] gap-2"><label className="text-xs font-semibold text-slate-600">날짜<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${selectClass}`}/></label><label className="text-xs font-semibold text-slate-600">시<select value={hour} onChange={(e) => { setHour(e.target.value); if (e.target.value === "20") setMinute("00"); }} className={`mt-1 ${selectClass}`}>{HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}</select></label><label className="text-xs font-semibold text-slate-600">분<select value={hour === "20" ? "00" : minute} disabled={hour === "20"} onChange={(e) => setMinute(e.target.value)} className={`mt-1 ${selectClass}`}>{MINUTES.map((m) => <option key={m} value={m}>{m}분</option>)}</select></label></div>
        <label className="mb-3 block text-xs font-semibold text-slate-600">상세 내용<textarea rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="통화·미팅 내용이나 다음 액션" className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"/></label>
        <label className="mb-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={showOnCalendar} onChange={(e) => setShowOnCalendar(e.target.checked)} className="h-4 w-4 accent-blue-600"/>캘린더에 표시</label>
        {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
        <button type="button" disabled={create.isPending} onClick={() => void doCreate().catch((e) => setError(e instanceof Error ? e.message : "저장 실패"))} className="h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{create.isPending ? "저장 중…" : "저장"}</button>
      </div>
    </div>
  );
}
