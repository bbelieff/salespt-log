"use client";

import { forwardRef, useRef, useState } from "react";
import type { Todo, TodoType } from "@/types";

const TYPE_BADGE: Record<TodoType, string> = { 미팅: "bg-blue-100 text-blue-700", 전화: "bg-green-100 text-green-700", 메시지: "bg-violet-100 text-violet-700", 기타: "bg-gray-100 text-gray-600", 일반: "bg-teal-100 text-teal-700" };
/** 「+ 결과」·「+ 다음」 점선 태그 — 부모(group) hover 때 실선·옅은 파랑. */
const TAG = "inline-block whitespace-nowrap rounded border border-dashed border-slate-300 bg-white px-1.5 text-px-11 font-semibold leading-5 text-blue-600 group-hover:border-solid group-hover:border-blue-300";
const INPUT = "h-9 rounded-md border border-slate-300 bg-white px-2 text-xs focus:border-blue-500 focus:outline-none";
const tomorrowKST = () => new Date(Date.now() + 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

interface Props {
  todo: Todo;
  /** 캘린더에서 넘어온 포커스 기록 — 테두리 강조. */
  ring?: boolean;
  /** 방금 추가한 기록 — 잠깐 옅은 파랑 배경. */
  fresh?: boolean;
  /** 「진행 N 기록으로」 지정 버튼(번호 없는 옛 기록 중 진행건이 애매한 것). */
  assignSlot?: 1 | 2 | 3;
  assignTitle?: string;
  onToggleDone: (done: boolean) => void;
  onSaveResult: (result: string) => void;
  /** 「+ 다음」 — 이 기록에 이어지는 새 할 일을 같은 진행건에 만든다. 실패하면 throw(입력 유지). */
  onCreateNext?: (title: string, date: string) => Promise<void>;
  /** 제목을 누르면 내용·일정 고치기(「자세히」 창 수정 모드). */
  onEdit?: () => void;
  onAssignSlot?: () => void;
  onRemove: () => void;
}

/**
 * Todo/History 한 줄(2026-10-27 belie 「투두 칸을 세 줄씩 쓸 필요 없음」) — 체크·제목·날짜·× 를 한 줄에.
 * 「Todo」 배지는 체크박스가 이미 말하므로 빼고 History 만, 종류 배지는 「기타」가 아닐 때만.
 * 아래 줄은 결과·「+ 결과」·「+ 다음」이 있을 때만 생긴다. 제목을 누르면 고치기.
 */
const TodoRow = forwardRef<HTMLDivElement, Props>(function TodoRow({ todo: t, ring, fresh, assignSlot, assignTitle, onToggleDone, onSaveResult, onCreateNext, onEdit, onAssignSlot, onRemove }, ref) {
  const history = t.기록종류 === "history";
  const done = t.완료여부 && !history;
  // 방금 완료로 바꾼 체크만 톡 튄다(효과 ③ — 처음 그릴 때 이미 완료인 줄은 가만히).
  const [pop, setPop] = useState(false);
  const result = (t.result ?? "").trim(); // 옛 캐시·합성 데이터 방어
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [nextOpen, setNextOpen] = useState(false);
  const settled = useRef(false); // Enter/Esc 로 닫은 뒤 뒤따르는 blur 가 한 번 더 저장하지 않게
  const open = () => { settled.current = false; setDraft(result); setEditing(true); };
  const close = () => { settled.current = true; setEditing(false); setDraft(""); };
  const commit = (value: string, fromBlur: boolean) => {
    if (settled.current) return;
    const next = value.trim();
    // 빈 값: 새로 쓰는 중이면 그냥 닫고, 고치는 중 Enter 면 결과를 지운다(blur 는 원래대로).
    if (!next && (fromBlur || !result)) return close();
    if (next !== result) onSaveResult(next);
    close();
  };
  const canNext = !!onCreateNext && (history || done);
  const tint = ring ? "ring-2 ring-inset ring-blue-400" : fresh ? "bg-blue-50" : "";
  const when = `${t.예정일자.slice(5).replace("-", "/")}${t.예정시각 ? ` ${t.예정시각}` : ""}`;
  return (
    <div ref={ref} data-todo-id={t.id} className={`px-2 py-1.5 transition-colors duration-700 ${tint}`}>
      <div className="flex min-w-0 items-center gap-1.5">
        {!history && <input type="checkbox" aria-label="완료 토글" checked={t.완료여부} onChange={(e) => { setPop(e.target.checked); onToggleDone(e.target.checked); }} onAnimationEnd={() => setPop(false)} className={`h-4 w-4 shrink-0 accent-blue-600 ${pop ? "fx-check-pop" : ""}`}/>}
        {history && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-px-11 font-bold text-amber-700">History</span>}
        {t.type !== "기타" && <span className={`shrink-0 rounded px-1.5 py-0.5 text-px-11 ${TYPE_BADGE[t.type]}`}>{t.type}</span>}
        {onEdit ? (
          <button type="button" onClick={onEdit} aria-label={`${t.제목} 고치기`} className={`min-w-0 flex-1 truncate rounded text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.제목}</button>
        ) : (
          <span className={`min-w-0 flex-1 truncate text-xs ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.제목}</span>
        )}
        <span className="shrink-0 text-px-11 tabular-nums text-slate-400">{when}</span>
        <button type="button" onClick={onRemove} className="-mr-1 inline-flex h-7 w-6 shrink-0 items-center justify-center text-slate-300 hover:text-red-500" aria-label="기록 삭제">×</button>
      </div>
      {/* 아래 줄 — 결과(초록)·「+ 결과」·「+ 다음」·진행건 지정. 없으면 줄 자체가 없다. */}
      {((done && !editing) || (canNext && !nextOpen) || assignSlot) && (
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1 pl-5">
          {done && result && !editing && (
            <button type="button" onClick={open} aria-label="결과 고치기" className="min-w-0 max-w-full truncate rounded px-0.5 text-left text-px-11 text-emerald-700 hover:bg-emerald-50">
              <span className="text-slate-400">결과 · </span>{result}
            </button>
          )}
          {done && !result && !editing && <button type="button" onClick={open} aria-label={`${t.제목} 결과 적기`} className="group rounded px-0.5 hover:bg-blue-50"><span className={TAG}>+ 결과</span></button>}
          {canNext && !nextOpen && <button type="button" onClick={() => setNextOpen(true)} aria-label={`${t.제목} 다음 할 일 적기`} className="group rounded px-0.5 hover:bg-blue-50"><span className={TAG}>+ 다음</span></button>}
          {assignSlot && <button type="button" onClick={onAssignSlot} title={assignTitle} className="shrink-0 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-px-11 font-semibold text-amber-800 hover:bg-amber-100">진행 {assignSlot} 기록으로</button>}
        </div>
      )}
      {editing && (
        <input
          autoFocus
          aria-label="결과 메모"
          value={draft}
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") { e.preventDefault(); commit(draft, false); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
          }}
          onBlur={(e) => commit(e.currentTarget.value, true)}
          placeholder="결과"
          className={`mt-1 w-full ${INPUT}`}
        />
      )}
      {nextOpen && onCreateNext && <NextTodoInput onCreate={onCreateNext} onClose={() => setNextOpen(false)}/>}
    </div>
  );
});

/**
 * 「+ 다음」 한 줄 입력 — 제목 + 날짜(기본 내일) + 저장·취소. Enter 저장, Esc·취소로 닫힘.
 * 바깥을 누르면 닫히던 동작은 뺐다(2026-10-27 belie): 휴대폰에서 달력을 열면 초점이 빠져 빈 입력칸이 닫히며 다음 할 일을 못 적었다.
 */
function NextTodoInput({ onCreate, onClose }: { onCreate: (title: string, date: string) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(tomorrowKST);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy || !title.trim()) return;
    setBusy(true); setError("");
    try { await onCreate(title.trim(), date || tomorrowKST()); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요. 다시 눌러 주세요."); setBusy(false); }
  };
  return (
    <div
      className="mt-1 pl-5"
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
        if (e.key === "Enter") { e.preventDefault(); void submit(); }
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <input autoFocus aria-label="다음 할 일" value={title} maxLength={100} disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder="다음 할 일" enterKeyHint="done" className={`min-w-0 flex-1 basis-40 ${INPUT}`}/>
        <div className="flex shrink-0 items-center gap-1.5">
          <input aria-label="다음 할 일 날짜" type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} className={`w-32 min-w-0 appearance-none px-1.5 ${INPUT}`}/>
          <button type="button" onClick={() => void submit()} disabled={busy || !title.trim()} className="h-9 shrink-0 rounded-md bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-40">{busy ? "저장 중" : "저장"}</button>
          <button type="button" onClick={onClose} disabled={busy} aria-label="다음 할 일 적기 취소" className="h-9 shrink-0 rounded-md px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">취소</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-px-11 font-medium text-red-600">{error}</p>}
    </div>
  );
}

export default TodoRow;
