/**
 * 컨택탭 주차 네비 유틸 (날짜 하드코딩 X — courseStart 인자 기반).
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

export function diffDays(later: Date, earlier: Date): number {
  return Math.round(
    (later.getTime() - earlier.getTime()) / 86_400_000,
  );
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** 주어진 날짜를 포함하는 주의 금요일(주 시작일) 반환.
 *  v2: 한 주 = 금요일~목요일 (숙제검사 목요일 마감 기준).
 *  JS getDay(): 0=일,1=월,2=화,3=수,4=목,5=금,6=토
 *  offset to last Friday: 금=0/토=1/일=2/월=3/화=4/수=5/목=6 */
export function friOf(d: Date): Date {
  const dow = d.getDay();
  const offset = (dow + 2) % 7;
  return addDays(d, -offset);
}

/** 주차 인덱스 — courseStart를 포함하는 금~목 주가 1주차. */
export function weekIndexOf(date: Date, courseStart: Date): number {
  const csFri = friOf(courseStart);
  const dateFri = friOf(date);
  const diff = diffDays(dateFri, csFri);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

/** 그 주차의 첫 날(금요일). */
export function weekStartOf(date: Date, courseStart: Date): Date {
  const w = weekIndexOf(date, courseStart);
  const csFri = friOf(courseStart);
  if (w === 0) return csFri;
  return addDays(csFri, (w - 1) * 7);
}

export function dayLabelKO(d: Date): string {
  return DAY_KO[d.getDay()] ?? "";
}

export function fmtMD(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function inEditPeriod(date: Date, courseStart: Date): boolean {
  const diff = diffDays(date, courseStart);
  return diff >= 0 && diff <= 69; // 8주 + 2주 마감유예
}
