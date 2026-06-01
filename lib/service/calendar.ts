/**
 * Layer: service — 캘린더 탭 유스케이스.
 *
 * 04 미팅 + 05 실무투두를 합쳐 월간 표시 (읽기 전용).
 * contact.ts 가 500줄 한도 초과 → 캘린더 유스케이스 분리 (2026-06, Scope 2).
 */
import { findUserByEmail } from "@/repo/users";
import { findByDateRange } from "@/repo/meetings";
import { findTodosByDateRange } from "@/repo/todos";
import type { Meeting, Todo } from "@/types";

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[calendar] 등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
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
 * yyyyMM은 "YYYY-MM" 형식. 04·05 각 1회 read (quota 2).
 */
export async function loadMonthMeetings(
  email: string,
  yyyyMM: string,
): Promise<CalendarMonthView> {
  const m = yyyyMM.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`[calendar] yyyyMM 포맷 오류: ${yyyyMM}`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1~12
  const spreadsheetId = await resolveSheet(email);

  // 그 달의 모든 날짜 생성 (1일 ~ 마지막날)
  const lastDay = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dd = String(d).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    dates.push(`${year}-${mm}-${dd}`);
  }

  // 04 미팅 + 05 투두 1회씩 read. 캘린더가 둘을 합쳐 표시(읽기 전용).
  const [map, todoMap] = await Promise.all([
    findByDateRange(spreadsheetId, dates, "meeting"),
    findTodosByDateRange(spreadsheetId, dates),
  ]);
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
