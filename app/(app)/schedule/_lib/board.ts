/** 주간 보드(일정·계약 탭 PC 격자) 계산 — 화면과 떨어진 순수 함수. 시안: docs/design/prototypes/schedule-week-board.html */
import type { Meeting, Todo } from "@/types";
import { addDays, fmtISO, parseISO } from "./week";

export type DayOrder = "fri" | "mon";
export const BOARD_START_H = 7;
export const BOARD_END_H = 22;
const SPAN = BOARD_END_H - BOARD_START_H;

/** 보이는 7일의 첫날 — 금~목은 수강 주(금) 그대로, 월~일은 그 수강 주 안의 월요일(금+3)부터. */
export function viewStartOf(courseWeekFri: string, order: DayOrder): string {
  return order === "fri" ? courseWeekFri : fmtISO(addDays(parseISO(courseWeekFri), 3));
}

/** 「11월 2주」 — 보이는 7일의 가운데 날(4번째)이 속한 달과 그 달의 몇째 주. */
export function monthWeekLabel(viewStart: string): string {
  const mid = addDays(parseISO(viewStart), 3);
  return `${mid.getMonth() + 1}월 ${Math.ceil(mid.getDate() / 7)}주`;
}

export const toHours = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
};
/** 격자 위 세로 위치(%) — 07시 0%, 22시 100%, 범위 밖은 끝에 붙인다. */
export const hourPct = (h: number) => Math.max(0, Math.min(100, ((h - BOARD_START_H) / SPAN) * 100));

/** 시간이 지났는데 아직 「예약」인 미팅 — 결과 입력 대기. 미팅 길이는 1시간으로 본다. */
export function needsResult(m: Meeting, now: Date): boolean {
  if (m.상태 !== "예약") return false;
  const end = parseISO(m.미팅날짜);
  const h = toHours(m.미팅시간) + 1;
  end.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
  return end < now;
}

export interface Placed<T> { item: T; start: number; end: number; lane: number; lanes: number }

/** 겹치는 일정은 나란히 — 겹친 묶음마다 필요한 칸 수만큼 나눈다. */
export function layoutLanes<T>(items: { item: T; start: number; end: number }[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    const cols: number[] = [];
    for (const p of group) {
      let c = cols.findIndex((end) => end <= p.start);
      if (c < 0) { c = cols.length; cols.push(0); }
      cols[c] = p.end;
      p.lane = c;
    }
    for (const p of group) p.lanes = cols.length;
    out.push(...group);
    group = [];
  };
  for (const it of sorted) {
    if (group.length && it.start >= groupEnd) { flush(); groupEnd = -Infinity; }
    group.push({ ...it, lane: 0, lanes: 1 });
    groupEnd = Math.max(groupEnd, it.end);
  }
  if (group.length) flush();
  return out;
}

/** 시간이 겹치는 투두는 쪼개지 말고 한 칸에 줄로 쌓는다 — 한 줄 0.45시간, 혼자면 45분 높이. */
export function groupTimedTodos(todos: Todo[]): { todos: Todo[]; start: number; end: number }[] {
  const out: { todos: Todo[]; start: number; end: number }[] = [];
  for (const t of [...todos].sort((a, b) => a.예정시각.localeCompare(b.예정시각))) {
    const s = toHours(t.예정시각);
    const g = out[out.length - 1];
    if (g && s < g.end) {
      g.todos.push(t);
      g.end = Math.max(g.end, g.start + g.todos.length * 0.45 + 0.1);
    } else out.push({ todos: [t], start: s, end: s + 0.75 });
  }
  return out;
}

/** 보드에 올리는 할 일 기록만(이미 한 일 history 는 빼고, 캘린더에서 숨긴 것도 뺀다). */
export const isBoardTodo = (t: Todo) => t.기록종류 !== "history" && t.showOnCalendar;
