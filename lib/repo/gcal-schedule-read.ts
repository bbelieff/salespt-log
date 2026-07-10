/**
 * Layer: repo — gcal [다시 올리기] 용 전 일정 열거(읽기 전용). 04 미팅·05 투두 탭 전체를
 * 파싱해 반환. rowToMeeting/rowToTodo 재사용(중복 파싱 방지). meetings.ts 500줄 캡 회피 분리.
 */
import { SHEET_RANGES } from "@/config";
import type { Meeting, Todo } from "@/types";
import { sheetsClient } from "./sheets-client";
import { rowToMeeting } from "./meetings";
import { ensureTodoTab, rowToTodo } from "./todos";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

/** 04 미팅 전체(취소 포함, id 중복 제거 — 첫 행 우선). */
export async function listAllMeetings(spreadsheetId: string): Promise<Meeting[]> {
  const tab = SHEET_RANGES.meetings.tab;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(tab)}!${SHEET_RANGES.meetings.range}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const seen = new Set<string>();
  const out: Meeting[] = [];
  for (const r of (res.data.values ?? []) as unknown[][]) {
    const m = rowToMeeting(r);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/** 05 실무투두 전체(id 중복 제거). */
export async function listAllTodos(spreadsheetId: string): Promise<Todo[]> {
  await ensureTodoTab(spreadsheetId);
  const tab = SHEET_RANGES.todos.tab;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(tab)}!${SHEET_RANGES.todos.range}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const seen = new Set<string>();
  const out: Todo[] = [];
  for (const r of (res.data.values ?? []) as unknown[][]) {
    const t = rowToTodo(r);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}
