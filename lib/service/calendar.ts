/**
 * Layer: service — 캘린더 탭 유스케이스.
 *
 * 04 미팅 + 05 실무투두를 합쳐 월간 표시 (읽기 전용).
 * contact.ts 가 500줄 한도 초과 → 캘린더 유스케이스 분리 (2026-06, Scope 2).
 */
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail } from "@/repo/users";
import { findByDateRange } from "@/repo/meetings";
import { findTodosByDateRange } from "@/repo/todos";
import { dbEnabled } from "@/repo/db/client";
import { readMeetingsFromDb, readTodosFromDb } from "@/repo/db/read-daily";
import { chooseDailySource } from "./daily-source";
import type { Meeting, Todo } from "@/types";

/** DB 경로 월간 조회 — 전체 미팅/투두 read 후 월 dates 로 필터(시트 findByDateRange 동치).
 *  미팅=미팅날짜 기준(캘린더), 투두=showOnCalendar && 예정일자 기준. null=실패(→시트 fallback). */
async function loadMonthFromDb(
  spreadsheetId: string,
  dates: string[],
): Promise<{ meetings: Map<string, Meeting[]>; todos: Map<string, Todo[]> } | null> {
  try {
    const wanted = new Set(dates);
    const [allMeetings, allTodos] = await Promise.all([
      readMeetingsFromDb(spreadsheetId),
      readTodosFromDb(spreadsheetId),
    ]);
    const meetings = new Map<string, Meeting[]>();
    const todos = new Map<string, Todo[]>();
    for (const d of dates) { meetings.set(d, []); todos.set(d, []); }
    for (const mtg of allMeetings) if (wanted.has(mtg.미팅날짜)) meetings.get(mtg.미팅날짜)!.push(mtg);
    for (const t of allTodos) if (t.showOnCalendar && wanted.has(t.예정일자)) todos.get(t.예정일자)!.push(t);
    return { meetings, todos };
  } catch (e) {
    Sentry.captureException(e, { tags: { where: "loadMonthMeetings-db-read" } });
    return null; // ↓ 시트 fallback
  }
}

export interface CalendarMonthView {
  yyyyMM: string; // "2026-04"
  /** 월의 모든 날짜 (YYYY-MM-DD) → 그 날 미팅 (미팅날짜 기준). */
  daysByMeetingDate: Array<{ date: string; meetings: Meeting[] }>;
  /** 그 달 실무투두 (예정일자 기준, showOnCalendar=true). Scope 2 — 05 실무투두. */
  daysByTodoDate: Array<{ date: string; todos: Todo[] }>;
}

/**
 * 한 달의 미팅(04) + 실무투두(05)를 합쳐 조회.
 * yyyyMM은 "YYYY-MM" 형식.
 *
 * R2-6(db-read-calendar): 파일럿 기수는 04·05 시트 read(2회) → DB(readMeetingsFromDb +
 * readTodosFromDb, 각 R2-2 패턴 재사용) 로 월 필터. 실패 시 기존 시트 경로 silent
 * fallback + Sentry. 비파일럿 불변. 표시문자열(N·O)·정렬 규칙 무변경.
 */
export async function loadMonthMeetings(
  email: string,
  yyyyMM: string,
): Promise<CalendarMonthView> {
  const m = yyyyMM.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`[calendar] yyyyMM 포맷 오류: ${yyyyMM}`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1~12
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[calendar] 등록되지 않은 사용자: ${email}`);
  const spreadsheetId = user.spreadsheetId;

  // 그 달의 모든 날짜 생성 (1일 ~ 마지막날)
  const lastDay = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dd = String(d).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    dates.push(`${year}-${mm}-${dd}`);
  }

  // 게이트: 파일럿 = DB 월 조회, 실패/비파일럿 = 시트 04·05 각 1회 read.
  let map: Map<string, Meeting[]>;
  let todoMap: Map<string, Todo[]>;
  const fromDb =
    chooseDailySource(user.cohort, dbEnabled()) === "db"
      ? await loadMonthFromDb(spreadsheetId, dates)
      : null;
  if (fromDb) {
    ({ meetings: map, todos: todoMap } = fromDb);
  } else {
    [map, todoMap] = await Promise.all([
      findByDateRange(spreadsheetId, dates, "meeting"),
      findTodosByDateRange(spreadsheetId, dates),
    ]);
  }
  const daysByMeetingDate = dates.map((d) => ({
    date: d,
    meetings: (map.get(d) ?? []).sort((a, b) =>
      a.미팅시간.localeCompare(b.미팅시간),
    ),
  }));
  const daysByTodoDate = dates.map((d) => ({
    date: d,
    todos: (todoMap.get(d) ?? []).sort((a, b) =>
      a.예정시각.localeCompare(b.예정시각),
    ),
  }));

  return { yyyyMM, daysByMeetingDate, daysByTodoDate };
}
