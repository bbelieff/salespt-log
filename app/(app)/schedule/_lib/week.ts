/**
 * 일정·계약 탭 주차 유틸 (날짜 하드코딩 X — courseStart 인자 기반).
 * 컨택탭 _lib/week.ts 와 동일 로직 — TODO(future): lib/util/week.ts 로 통합
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
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
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
