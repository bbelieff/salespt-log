"use client";

import { useEffect, useRef, useState } from "react";
import type { Todo, TodoRecordKind } from "@/types";
import { newTodoOperationId, useCreateTodo, usePatchTodo, useRemoveTodo } from "@/query/todos-hooks";
import { useFocusScroll } from "@/lib/hooks/useFocusScroll";
import TodoFormModal, { seedFromTodo, type TodoDraftSeed } from "./TodoFormModal";
import TodoRow from "./TodoRow";

const SLOT_ACCENT = {
  emerald: { shell: "border-emerald-300 bg-emerald-100", active: "bg-emerald-600" },
  blue: { shell: "border-blue-300 bg-blue-100", active: "bg-blue-600" },
  violet: { shell: "border-violet-300 bg-violet-100", active: "bg-violet-600" },
} as const;
/** 바로 추가에 쓰는 기본 시각 — 시각을 고르려면 「자세히」. */
const QUICK_TIME = { hour: "09", minute: "00" } as const;
const FRESH_MS = 2000;
const kstISO = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
/** 날짜를 비우면 할 일은 내일, 한 일은 오늘. */
const defaultDate = (kind: TodoRecordKind) => kstISO(kind === "history" ? 0 : 1);

interface Props {
  contractRef: string;
  institutionRef: string;
  draftInstitution?: string;
  companyName: string;
  todos: Todo[];
  focusId?: string | null;
  onEnsureSaved?: () => void;
  accentFamily?: keyof typeof SLOT_ACCENT;
  /** 이 칸이 몇 번째 진행건인가 — 새 기록에 함께 저장한다. */
  slot?: number;
  /** 진행건 번호 없는 옛 기록 중 어디 것인지 확실하지 않은 기록 — 같은 기관 진행건이 여럿이거나, 기관 이름이 어느 진행건과도 같지 않음(todo-slot). */
  ambiguousIds?: Set<string>;
}

export default function TodoSection({ contractRef, institutionRef, draftInstitution, companyName, todos, focusId, onEnsureSaved, accentFamily = "emerald", slot, ambiguousIds }: Props) {
  const create = useCreateTodo();
  const patch = usePatchTodo();
  const remove = useRemoveTodo();
  const [kind, setKind] = useState<TodoRecordKind>("todo");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => defaultDate("todo"));
  const [dateTouched, setDateTouched] = useState(false);
  const [opId, setOpId] = useState(newTodoOperationId);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState<TodoDraftSeed | null>(null);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saved = institutionRef.trim();
  const effective = saved || (draftInstitution ?? "").trim();
  const focusActive = !!focusId && todos.some((t) => t.id === focusId);
  const { ref: focusedRef, ring } = useFocusScroll<HTMLDivElement>(focusActive);
  const accent = SLOT_ACCENT[accentFamily];
  const canAdd = !!effective && !!title.trim() && !create.isPending;

  useEffect(() => {
    if (!freshId) return;
    const timer = window.setTimeout(() => setFreshId(null), FRESH_MS);
    return () => window.clearTimeout(timer);
  }, [freshId]);

  const pickKind = (k: TodoRecordKind) => { setKind(k); if (!dateTouched) setDate(defaultDate(k)); };
  const resetDraft = () => { setTitle(""); setDate(defaultDate(kind)); setDateTouched(false); setOpId(newTodoOperationId()); };

  /** 제목·날짜만으로 바로 저장(팝업 없음) — 모달과 같은 생성 경로(진행건 번호·기관·계약 연결). */
  const quickAdd = async () => {
    if (!canAdd) return;
    if (!saved) onEnsureSaved?.();
    setError("");
    try {
      const res = await create.mutateAsync({ contractRef, institutionRef: effective, slot: slot ?? null, 업체명: companyName, 기록종류: kind, type: "기타", 제목: title.trim(), 예정일자: date || defaultDate(kind), 예정시각: `${QUICK_TIME.hour}:${QUICK_TIME.minute}`, 장소: "", 상세: "", showOnCalendar: true, operationId: opId });
      setFreshId(res.todo.id);
      resetDraft();
      titleRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요. 다시 눌러 주세요.");
    }
  };
  /** 「+ 다음」 — 끝난 기록에 이어지는 새 할 일. 같은 진행건(계약·기관·번호)에 바로 저장, 원래 기록 id 를 prevId 로 남긴다. */
  const createNext = async (source: Todo, nextTitle: string, nextDate: string) => {
    const res = await create.mutateAsync({ contractRef, institutionRef: effective || source.institutionRef, slot: slot ?? source.slot ?? null, 업체명: companyName, 기록종류: "todo", type: "기타", 제목: nextTitle, 예정일자: nextDate, 예정시각: `${QUICK_TIME.hour}:${QUICK_TIME.minute}`, 장소: "", 상세: "", showOnCalendar: true, prevId: source.id, operationId: newTodoOperationId() });
    setFreshId(res.todo.id);
  };
  const openDetail = () => {
    if (!effective) return;
    if (!saved) onEnsureSaved?.();
    setSeed({ 기록종류: kind, 제목: title.trim(), 예정일자: date || defaultDate(kind), ...QUICK_TIME });
  };

  return (
    <div className={`rounded-lg border border-dashed p-2.5 ${accent.shell}`}>
      <div className="mb-1.5 text-xs font-bold text-slate-700">할 일</div>
      {/* 목록은 흰 판 하나 + 줄 구분선(상자 다이어트: 기록마다 상자를 치지 않는다). */}
      {todos.length > 0 && <div className="fx-stagger mb-2 divide-y divide-slate-100 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">{todos.map((t) => (
        <TodoRow
          key={t.id}
          ref={t.id === focusId ? focusedRef : undefined}
          todo={t}
          ring={ring && t.id === focusId}
          fresh={t.id === freshId}
          assignSlot={slot && ambiguousIds?.has(t.id) ? slot : undefined}
          assignTitle={`어느 진행건 기록인지 확실하지 않아요${t.institutionRef.trim() ? ` (기록의 기관: ${t.institutionRef.trim()})` : ""}. 이 진행건 기록이면 눌러 주세요.`}
          onToggleDone={(done) => patch.mutate({ contractRef, id: t.id, partial: { 완료여부: done } })}
          onSaveResult={(result) => patch.mutate({ contractRef, id: t.id, partial: { result } })}
          onCreateNext={effective ? (nextTitle, nextDate) => createNext(t, nextTitle, nextDate) : undefined}
          onEdit={() => setEditTodo(t)}
          onAssignSlot={() => { if (slot) patch.mutate({ contractRef, id: t.id, partial: { slot } }); }}
          onRemove={() => remove.mutate({ contractRef, id: t.id })}
        />
      ))}</div>}
      {/* 추가 칸 2줄(2026-10-27 belie 「칸 사용이 주먹구구」): 1줄 Todo/History + 제목, 2줄 날짜·추가·자세히. */}
      <form className="flex min-w-0 flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); void quickAdd(); }}>
        <div className="flex min-w-0 items-center gap-1.5">
        <div className="flex shrink-0 rounded-md bg-white p-0.5 ring-1 ring-slate-200">{(["todo", "history"] as TodoRecordKind[]).map((k) => <button type="button" key={k} onClick={() => pickKind(k)} aria-pressed={kind === k} className={`h-8 rounded px-2 text-px-11 font-bold ${kind === k ? `${accent.active} text-white` : "text-slate-500"}`}>{k === "todo" ? "Todo" : "History"}</button>)}</div>
        <input ref={titleRef} aria-label="기록 제목" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={effective ? (kind === "todo" ? "할 일" : "한 일") : "진행기관 먼저 입력"} disabled={!effective} autoComplete="off" enterKeyHint="done" className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-100"/>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <input aria-label="기록 날짜" type="date" value={date} onChange={(e) => { setDate(e.target.value); setDateTouched(true); }} className="h-9 w-32 min-w-0 appearance-none rounded-md leading-9 border border-slate-300 bg-white px-1.5 text-xs"/>
          <button type="submit" disabled={!canAdd} className="h-9 shrink-0 whitespace-nowrap rounded-md bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-40">{create.isPending ? "저장 중" : "추가"}</button>
          <button type="button" onClick={openDetail} disabled={!effective} title="시각·종류·상세 내용까지 적기" className="h-9 shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">자세히</button>
        </div>
      </form>
      {error && <p role="alert" className="mt-1 text-px-11 font-medium text-red-600">{error}</p>}
      {editTodo && <TodoFormModal contractRef={contractRef} institutionRef={editTodo.institutionRef || effective} slot={slot} companyName={companyName} initial={seedFromTodo(editTodo)} editing={editTodo} onClose={() => setEditTodo(null)}/>}
      {seed && <TodoFormModal contractRef={contractRef} institutionRef={effective} slot={slot} companyName={companyName} initial={seed} onClose={() => { setSeed(null); resetDraft(); }}/>}
    </div>
  );
}
