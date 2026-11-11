"use client";
/**
 * 실무 투두 창 — 실무수납 탭 투두와 같은 흐름: 완료 → 결과 한 줄 → 「다음」 할 일(같은 업체·진행건, 기본 다음 날 09:00).
 * 저장은 실무수납 탭과 같은 훅(usePatchTodo·useCreateTodo) — 그 탭·캘린더도 함께 갱신된다.
 */
import Link from "next/link";
import { useState } from "react";
import type { Route } from "next";
import type { Todo } from "@/types";
import DateInputCustom from "@/components/ui/DateInputCustom";
import TimeSelectPair from "@/components/ui/TimeSelectPair";
import { newTodoOperationId, useCreateTodo, usePatchTodo } from "@/query/todos-hooks";
import { addDays, fmtISO, parseISO } from "../../_lib/week";
import BoardPopover from "./BoardPopover";
import { TodoTypeGlyph } from "./glyphs";

const INPUT = "h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-violet-500 focus:outline-none";

export default function TodoPopover({ todo, anchor, onClose, onSaved }: {
  todo: Todo; anchor: DOMRect | null; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const patch = usePatchTodo();
  const create = useCreateTodo();
  const [done, setDone] = useState(todo.완료여부);
  const [result, setResult] = useState(todo.result ?? "");
  const [nextTitle, setNextTitle] = useState("");
  const [nextDate, setNextDate] = useState(() => fmtISO(addDays(parseISO(todo.예정일자), 1)));
  const [nextTime, setNextTime] = useState("09:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const partial: Partial<Omit<Todo, "id">> = {};
      if (done !== todo.완료여부) partial.완료여부 = done;
      if (result.trim() !== (todo.result ?? "")) partial.result = result.trim();
      if (Object.keys(partial).length) await patch.mutateAsync({ contractRef: todo.contractRef, id: todo.id, partial });
      if (nextTitle.trim()) {
        await create.mutateAsync({
          contractRef: todo.contractRef, institutionRef: todo.institutionRef, slot: todo.slot ?? null, 업체명: todo.업체명,
          기록종류: "todo", type: "기타", 제목: nextTitle.trim(), 예정일자: nextDate, 예정시각: nextTime || "09:00",
          장소: "", 상세: "", showOnCalendar: true, prevId: todo.id, operationId: newTodoOperationId(),
        });
      }
      onSaved(nextTitle.trim() ? `✓ 저장 + 다음 할 일 「${nextTitle.trim()}」 추가` : "✓ 저장했어요");
      onClose();
    } catch (e) {
      setError(`저장하지 못했어요: ${(e as Error).message} — 입력은 그대로 있어요.`);
    } finally {
      setBusy(false);
    }
  };

  const when = `${todo.예정일자.slice(5).replace("-", "/")}${todo.예정시각 ? ` ${todo.예정시각}` : ""}`;
  return (
    <BoardPopover anchor={anchor} onClose={onClose} label={`${todo.업체명} ${todo.제목}`} title={<>
      <h3 className="truncate text-lg font-black tracking-tight text-slate-900">{todo.업체명 || "실무 투두"}</h3>
      <p className="mt-0.5 flex items-start gap-1.5 text-px-15 font-bold leading-snug text-slate-800"><TodoTypeGlyph type={todo.type} className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{todo.제목}</span></p>
      <p className="mt-1 text-xs tabular-nums text-slate-500">{when} · {todo.type}{todo.institutionRef ? ` · ${todo.institutionRef}${todo.slot ? ` 진행건 ${todo.slot}` : ""}` : ""}</p>
    </>}>
      <div className="grid gap-2.5">
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-800">
          <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} className="h-4 w-4 accent-green-600" />완료로 표시
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">결과
          <input value={result} maxLength={100} onChange={(e) => setResult(e.target.value)} placeholder="한 줄로 — 예: 서류 받음, 다음 주 재통화" className={INPUT} />
        </label>
        <fieldset className="grid min-w-0 gap-1.5 rounded-xl border border-dashed border-slate-300 p-2">
          <legend className="px-1 text-xs font-bold text-slate-600">다음 할 일 <span className="font-medium text-slate-400">· 같은 업체{todo.slot ? "·진행건" : ""}으로 이어서</span></legend>
          <input value={nextTitle} maxLength={100} onChange={(e) => setNextTitle(e.target.value)} placeholder="비워 두면 만들지 않아요" aria-label="다음 할 일" className={INPUT} />
          <div className="flex flex-wrap items-center gap-1.5">
            <DateInputCustom ariaLabel="다음 할 일 날짜" value={nextDate} onChange={setNextDate} compact className="h-10 !w-36" />
            <TimeSelectPair value={nextTime} onChange={setNextTime} hourMin={7} hourMax={22} ariaLabel="다음 할 일 시각" />
          </div>
        </fieldset>
        {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
        <button type="button" disabled={busy} onClick={save} className="h-11 rounded-xl bg-violet-700 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60">
          {busy ? "저장중.." : todo.완료여부 ? "결과 저장" : "완료하고 저장"}
        </button>
        {todo.contractRef && (
          <Link href={`/payment?focus=${encodeURIComponent(todo.id)}` as Route} className="justify-self-center text-xs font-bold text-slate-500 underline underline-offset-4 hover:text-violet-700">실무수납 탭에서 이 업체 열기 →</Link>
        )}
      </div>
    </BoardPopover>
  );
}
