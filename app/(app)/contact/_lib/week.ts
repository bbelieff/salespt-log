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

export function weekIndexOf(date: Date, courseStart: Date): number {
  const diff = diffDays(date, courseStart);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

/** 그 주차의 첫 날(코스 시작일과 같은 요일). */
export function weekStartOf(date: Date, courseStart: Date): Date {
  const w = weekIndexOf(date, courseStart);
  if (w === 0) return courseStart;
  return addDays(courseStart, (w - 1) * 7);
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
