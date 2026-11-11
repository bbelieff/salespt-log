"use client";
/** 폰·태블릿 일정 목록에 더하는 것 — 주간 이슈 판 · 날짜별 메모/투두/일정 · 투두·일정 시트. PC 보드와 같은 데이터·저장. */
import { useMemo, useState } from "react";
import type { Todo } from "@/types";
import { useAllTodos } from "@/query/todos-hooks";
import { useSaveScheduleNote, useScheduleNotes } from "@/query/schedule-notes-hooks";
import { isBoardTodo } from "../../_lib/board";
import { IssuesPanel } from "./SidePanels";
import MobileDayExtra from "./MobileDayExtra";
import TodoPopover from "./TodoPopover";
import EventPopover from "./EventPopover";

export function useMobileExtras({ enabled, viewStart, courseWeekFri, toast }: { enabled: boolean; viewStart: string; courseWeekFri: string; toast: (m: string) => void }) {
  const todosQuery = useAllTodos({ enabled });
  const notes = useScheduleNotes(viewStart, courseWeekFri);
  const save = useSaveScheduleNote();
  const [todo, setTodo] = useState<Todo | null>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const byDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    for (const t of todosQuery.data?.todos ?? []) if (isBoardTodo(t)) map.set(t.예정일자, [...(map.get(t.예정일자) ?? []), t]);
    return map;
  }, [todosQuery.data]);
  const ready = notes.isSuccess;

  return {
    issuesPanel: (
      <div className="surface-panel !p-0 overflow-hidden">
        <IssuesPanel issues={notes.data?.issues ?? []} ready={ready}
          onChange={(issues) => save.mutate({ kind: "issues", weekStart: courseWeekFri, issues }, { onError: () => toast("이슈를 저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요.") })} />
      </div>
    ),
    dayExtra: (date: string) => (
      <MobileDayExtra date={date} todos={byDate.get(date) ?? []} memo={notes.data?.memos[date] ?? ""} memoReady={ready}
        onMemo={(d, text) => save.mutate({ kind: "memo", date: d, text }, { onError: () => toast("메모를 저장하지 못했어요 — 잠시 뒤 다시 적어 주세요.") })}
        onTodo={setTodo} onCreate={setNewDate} />
    ),
    sheets: (
      <>
        {todo && <TodoPopover todo={todo} anchor={null} onClose={() => setTodo(null)} onSaved={toast} />}
        {newDate && <EventPopover date={newDate} time="09:00" anchor={null} onClose={() => setNewDate(null)} onSaved={toast} />}
      </>
    ),
  };
}
