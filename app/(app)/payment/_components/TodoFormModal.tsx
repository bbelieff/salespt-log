"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { newTodoOperationId, useCreateTodo, usePatchTodo } from "@/query/todos-hooks";
import { useDirtyEntry, useGuardedNav } from "@/components/DirtyGuard";
import type { Todo, TodoRecordKind, TodoType } from "@/types";

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
  /** 몇 번째 진행건의 기록인가(없으면 옛 방식). */
  slot?: 1 | 2 | 3;
  companyName: string;
  initial: TodoDraftSeed;
  /** 있으면 수정 모드(2026-10-27 belie 「투두 내용·일정이 바뀌면 고치고 싶다」) — 이 기록을 고친다. 종류(Todo/History)는 못 바꾼다(서버 PATCH 미지원). */
  editing?: Todo;
  onClose: () => void;
}

/** 수정할 기록 → 창 초기값. 시각이 목록(9~20시·15분 단위)에 없으면 그 값도 고를 수 있게 둔다. */
export function seedFromTodo(t: Todo): TodoDraftSeed {
  const [h = "09", m = "00"] = (t.예정시각 || "09:00").split(":");
  return { 기록종류: t.기록종류, 제목: t.제목, 예정일자: t.예정일자, hour: h, minute: m };
}

export default function TodoFormModal({ contractRef, institutionRef, slot, companyName, initial, editing, onClose }: Props) {
  const create = useCreateTodo();
  const patch = usePatchTodo();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<TodoRecordKind>(initial.기록종류);
  const [type, setType] = useState<TodoType>(editing?.type ?? "기타");
  const [title, setTitle] = useState(initial.제목);
  const [date, setDate] = useState(initial.예정일자);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.hour === "20" ? "00" : initial.minute);
  const [detail, setDetail] = useState(editing?.상세 ?? "");
  const [showOnCalendar, setShowOnCalendar] = useState(editing?.showOnCalendar ?? true);
  const [error, setError] = useState("");
  const [opId] = useState(newTodoOperationId);

  const doCreate = async () => {
    if (!title.trim()) throw new Error("제목을 입력해주세요.");
    if (!date) throw new Error("날짜를 선택해주세요.");
    const 예정시각 = `${hour}:${hour === "20" ? "00" : minute}`;
    if (editing) await patch.mutateAsync({ contractRef, id: editing.id, partial: { type, 제목: title.trim(), 예정일자: date, 예정시각, 상세: detail.trim(), showOnCalendar } });
    else await create.mutateAsync({ contractRef, institutionRef, slot: slot ?? null, 업체명: companyName, 기록종류: kind, type, 제목: title.trim(), 예정일자: date, 예정시각, 장소: "", 상세: detail.trim(), showOnCalendar, operationId: opId });
    onClose();
  };
  // 바꾼 게 있을 때만 「저장하지 않고 나갈까요?」 — 열어 보고 그냥 닫으면 묻지 않는다(2026-10-28 오류신고).
  const changed = kind !== initial.기록종류 || type !== (editing?.type ?? "기타") || title !== initial.제목 || date !== initial.예정일자
    || hour !== initial.hour || minute !== (initial.hour === "20" ? "00" : initial.minute) || detail !== (editing?.상세 ?? "")
    || showOnCalendar !== (editing?.showOnCalendar ?? true);
  useDirtyEntry(`todo-${contractRef}-${institutionRef}${editing ? `-${editing.id}` : ""}`, changed, doCreate, onClose, `${kind === "todo" ? "Todo" : "History"} · ${companyName}`);
  const guardedNav = useGuardedNav();
  const close = useCallback(() => guardedNav(onClose), [guardedNav, onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  // 날짜·시·분은 같은 높이·폭 규칙(2026-10-27 belie): iOS 날짜 칸은 기본 모양이 높이·폭을 무시하므로 appearance-none + min-w-0.
  const selectClass = "block h-10 w-full min-w-0 appearance-none rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none";
  const hours = HOURS.includes(hour) ? HOURS : [...HOURS, hour].sort();
  const minutes = MINUTES.includes(minute) || hour === "20" ? MINUTES : [...MINUTES, minute].sort();
  const pending = create.isPending || patch.isPending;
  // 겹침 순서는 다른 확인창들과 같은 z-[300] — 「저장하지 않고 나갈까요?」(z-[350])가 이 창 위에 떠야 누를 수 있다.
  // (z-[400] 이던 때 확인창이 뒤에 깔려 저장 말고는 빠져나갈 수 없었다 — 2026-10-28 오류신고.)
  const modal = (
    <div className="fx-sheet-wrap fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={close}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${kind === "todo" ? "Todo" : "History"} ${editing ? "고치기" : "상세"}`}
        tabIndex={-1}
        className="fx-sheet max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-white/70 bg-white/95 p-4 shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between"><div><p className="text-px-11 font-semibold text-blue-600">{institutionRef}</p><h3 className="text-lg font-black text-slate-950">{kind === "todo" ? "할 일" : "한 일"}</h3></div><button type="button" onClick={close} className="p-2 text-slate-400" aria-label="닫기">×</button></div>
        {!editing && <div className="mb-3 grid grid-cols-2 rounded-lg bg-slate-100 p-1">{(["todo", "history"] as TodoRecordKind[]).map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`h-8 rounded-md text-xs font-bold ${kind === k ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>{k === "todo" ? "할 일" : "한 일"}</button>)}</div>}
        <div className="mb-3 flex flex-wrap gap-1.5">{TYPES.map((t) => <button key={t} type="button" onClick={() => setType(t)} className={`h-7 rounded-full border px-2.5 text-xs font-semibold ${type === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500"}`}>{t}</button>)}</div>
        <label className="mb-3 block text-xs font-semibold text-slate-600">제목<input value={title} onChange={(e) => setTitle(e.target.value)} className={`mt-1 ${selectClass}`}/></label>
        <div className="mb-3 grid grid-cols-4 gap-2"><label className="col-span-2 min-w-0 text-xs font-semibold text-slate-600">날짜<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${selectClass}`}/></label><label className="min-w-0 text-xs font-semibold text-slate-600">시<select value={hour} onChange={(e) => { setHour(e.target.value); if (e.target.value === "20") setMinute("00"); }} className={`mt-1 ${selectClass}`}>{hours.map((h) => <option key={h} value={h}>{h}시</option>)}</select></label><label className="min-w-0 text-xs font-semibold text-slate-600">분<select value={hour === "20" ? "00" : minute} disabled={hour === "20"} onChange={(e) => setMinute(e.target.value)} className={`mt-1 ${selectClass}`}>{minutes.map((m) => <option key={m} value={m}>{m}분</option>)}</select></label></div>
        <label className="mb-3 block text-xs font-semibold text-slate-600">메모<textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"/></label>
        <label className="mb-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={showOnCalendar} onChange={(e) => setShowOnCalendar(e.target.checked)} className="h-4 w-4 accent-blue-600"/>캘린더에 표시</label>
        {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}
        <button type="button" disabled={pending} onClick={() => void doCreate().catch((e) => setError(e instanceof Error ? e.message : "저장 실패"))} className="h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{pending ? "저장 중…" : "저장"}</button>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(modal, document.body);
}
