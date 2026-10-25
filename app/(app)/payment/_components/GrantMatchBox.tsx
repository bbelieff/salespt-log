/**
 * 실무 칸 「🎯 맞는 공고」(2026-10-26 맞춤공고 4단계 — belie 승인 목업 ②·⑤). 로드맵 메모와 실무진행 사이, 접는 상자.
 * 줄: 판정 배지(소진 임박/맞음/확인 필요) · 공고명 · 한 줄(지역·한도·마감) · 「할 일로 담기」. 「확인 필요」만 이유 한 줄.
 * 담은 공고는 목록에서 빠지고 같은 상자 「담은 공고」에 할 일로 보인다 — 한 공고는 한 곳에만(핸드오프 §4-B).
 * 담기 = 업체 단위 할 일(진행건 미지정, 분류 "공고:<id>", 날짜 = 마감 3일 전·없으면 내일). 진행건 연결은 수강생이 직접(§3 ④).
 * 업체 지역·업종은 다시 적지 않는다(§3 ①). 맞는 공고·담은 공고가 둘 다 없으면 상자를 그리지 않는다.
 * 데이터는 실무/수납 page 의 useGrantMatches, 할 일은 ContractRow 의 계약별 할 일.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import DisclosureChevron from "@/components/ui/DisclosureChevron";
import type { Todo } from "@/types";
import { grantTodoDue, type GrantMatchesResponse } from "@/lib/analytics/grant-match";
import { GRANT_TODO_PREFIX, grantIdOfTodo, isGrantTodo } from "@/lib/analytics/todo-slot";
import { newTodoOperationId, useCreateTodo, usePatchTodo, useRemoveTodo } from "@/query/todos-hooks";
import { contractRef } from "@/util/contract-ref";
import { todayKST } from "@/util/week";
import TodoRow from "./TodoRow";

const BADGE = {
  urgent: ["소진 임박", "bg-rose-50 text-rose-700 ring-rose-200"],
  match: ["맞음", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  check: ["확인 필요", "bg-amber-50 text-amber-800 ring-amber-200"],
} as const;

interface Props { 계약일: string; 업체명: string; grants?: GrantMatchesResponse; todos?: Todo[] }

export default function GrantMatchBox({ 계약일, 업체명, grants: data, todos = [] }: Props) {
  const create = useCreateTodo();
  const patch = usePatchTodo();
  const remove = useRemoveTodo();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const ref = contractRef(계약일, 업체명);
  const taken = todos.filter(isGrantTodo);
  const takenIds = new Set(taken.map(grantIdOfTodo));
  const mine = data && !data.unavailable ? data.companies[ref] : undefined;
  const rows = (mine?.matches ?? []).filter((m) => data?.announcements[m.id] && !takenIds.has(m.id));
  if (rows.length === 0 && taken.length === 0) return null;
  const ok = rows.filter((m) => m.verdict === "match").length;
  const check = rows.length - ok;

  const take = async (id: string) => {
    const a = data!.announcements[id]!;
    setBusy(id);
    setError("");
    try {
      await create.mutateAsync({
        contractRef: ref, institutionRef: "", slot: null, 업체명, 기록종류: "todo", type: "기타",
        제목: `${a.title} 신청 준비`, 예정일자: grantTodoDue(a.deadlineDate, todayKST()), 예정시각: "09:00",
        장소: "", 상세: a.link, showOnCalendar: true, 분류: `${GRANT_TODO_PREFIX}${id}`, operationId: newTodoOperationId(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "담지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusy("");
    }
  };

  return (
    <details data-grant-match-box className="group rounded-lg border border-slate-200 bg-white">
      <summary className="disclosure-summary payment-sticky-title flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-800 group-open:rounded-b-none">
        <span>🎯 맞는 공고 {ok}{check > 0 && <span className="font-normal text-slate-500"> · 확인 {check}</span>}{taken.length > 0 && <span className="font-normal text-slate-500"> · 담음 {taken.length}</span>}</span>
        <DisclosureChevron />
      </summary>
      {rows.length > 0 && <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {rows.map((m) => {
          const a = data!.announcements[m.id]!;
          const [label, tone] = BADGE[m.urgent ? "urgent" : m.verdict];
          const line = [a.regionText, a.maxAmount, a.deadlineText && `마감 ${a.deadlineText}`].filter(Boolean).join(" · ");
          return (
            <li key={m.id} className="flex items-start gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-px-11 font-bold ring-1 ${tone}`}>{label}</span>
                  {a.link
                    ? <a href={a.link} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-sm font-semibold text-slate-900 hover:text-blue-700 hover:underline">{a.title}</a>
                    : <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{a.title}</span>}
                </div>
                {line && <p className="mt-0.5 truncate text-px-11 text-slate-500">{line}</p>}
                {m.verdict === "check" && m.reasons[0] && <p className="mt-0.5 truncate text-px-11 text-amber-800">{m.reasons.join(" · ")}</p>}
              </div>
              <button type="button" disabled={busy !== ""} onClick={() => void take(m.id)}
                className="min-h-8 shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                {busy === m.id ? "담는 중…" : "할 일로 담기"}
              </button>
            </li>
          );
        })}
      </ul>}
      {error && <p role="alert" className="border-t border-slate-100 px-3 py-1.5 text-xs text-red-600">{error}</p>}
      {taken.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 px-3 py-2">
          <p className="text-xs font-bold text-slate-600">담은 공고</p>
          {taken.map((t) => (
            <TodoRow key={t.id} todo={t}
              onToggleDone={(done) => patch.mutate({ contractRef: ref, id: t.id, partial: { 완료여부: done } })}
              onSaveResult={(result) => patch.mutate({ contractRef: ref, id: t.id, partial: { result } })}
              onRemove={() => remove.mutate({ contractRef: ref, id: t.id })} />
          ))}
        </div>
      )}
      <div className="border-t border-slate-100 px-3 py-1.5 text-right">
        <Link href="/payment/news" className="text-xs font-semibold text-blue-700 hover:underline">공고별로 보기 →</Link>
      </div>
    </details>
  );
}

/** 목록 카드 칩 「공고 N」 / 「지역 없음」. 업체정보가 없으면 아무것도 안 붙인다. 담은 공고는 page 가 미리 뺀다(withoutTaken). */
export function GrantChip({ 계약일, 업체명, grants: data }: { 계약일: string; 업체명: string; grants?: GrantMatchesResponse }) {
  const mine = data && !data.unavailable ? data.companies[contractRef(계약일, 업체명)] : undefined;
  if (!mine?.hasInfo) return null;
  if (mine.noRegion) return <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-px-11 font-semibold text-slate-500">지역 없음</span>;
  const n = mine.matches.length;
  if (n === 0) return null;
  return <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-px-11 font-bold text-emerald-700 ring-1 ring-emerald-200">공고 {n}</span>;
}
