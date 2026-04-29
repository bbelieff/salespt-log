/**
 * 캘린더 탭 월 단위 유틸.
 * 한 달의 6×7 그리드 셀 데이터를 만든다 (앞뒤 공백 + 그 달 + 트레일).
 */

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 그 달 1일이 무슨 요일(일=0~토=6). */
export function firstDayOfWeek(year: number, month1: number): number {
  return new Date(year, month1 - 1, 1).getDay();
}

export function lastDayOfMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

export interface CalendarCell {
  /** YYYY-MM-DD. inMonth=false면 앞 공백/트레일. */
  date: string;
  day: number; // 1~31
  inMonth: boolean;
  dow: number; // 0~6
}

/**
 * 한 달의 6×7 그리드 셀 (총 42칸).
 * 첫 행은 일요일 시작. 1일 전은 이전 달, 말일 후는 다음 달 트레일.
 */
export function buildMonthGrid(yyyyMM: string): CalendarCell[] {
  const m = yyyyMM.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`yyyyMM 포맷 오류: ${yyyyMM}`);
  const year = Number(m[1]);
  const month = Number(m[2]);

  const firstDow = firstDayOfWeek(year, month);
  const last = lastDayOfMonth(year, month);

  const cells: CalendarCell[] = [];
  // 이전 달 트레일
  if (firstDow > 0) {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevLast = lastDayOfMonth(prevYear, prevMonth);
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = prevLast - i;
      const date = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date, day: d, inMonth: false, dow: cells.length % 7 });
    }
  }
  // 그 달
  for (let d = 1; d <= last; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date, day: d, inMonth: true, dow: cells.length % 7 });
  }
  // 트레일 (42칸 채울 때까지)
  let nextYear = month === 12 ? year + 1 : year;
  let nextMonth = month === 12 ? 1 : month + 1;
  let nd = 1;
  while (cells.length < 42) {
    const date = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
    cells.push({ date, day: nd, inMonth: false, dow: cells.length % 7 });
    nd++;
  }
  return cells;
}

export function dayLabelHeader(): string[] {
  return DAY_KO;
}

/** 월 +/- 이동 (yyyyMM 입력 → yyyyMM 반환). */
export function shiftMonth(yyyyMM: string, delta: number): string {
  const m = yyyyMM.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyyMM;
  let year = Number(m[1]);
  let month = Number(m[2]) + delta;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** 그 날짜가 속한 주의 토요일(또는 수강시작일과 같은 요일) 시작. 단순화: ISO date의 일요일 기준. */
export function weekStartOfDate(date: string, courseStart: string): string {
  // courseStart의 dow를 기준 시작 요일로 삼음
  const cs = parseISO(courseStart);
  const dow = cs.getDay();
  const target = parseISO(date);
  const targetDow = target.getDay();
  const diff = (targetDow - dow + 7) % 7;
  const ws = new Date(target);
  ws.setDate(target.getDate() - diff);
  return fmtYMD(ws);
}
