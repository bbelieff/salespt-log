/**
 * 주차 계산 SSOT — 순수 날짜 유틸 (import 0, 어느 레이어에서나 사용 가능).
 * R4 W1-0: 레포에 5중복이던 weekIndexOf 를 여기로 단일화 (G8 구조가드가 재구현 차단).
 *
 * ⚠️ 주차에는 **서로 다른 두 앵커**가 있다 — 이름으로 구분한다. 섞으면 시트 row 가 틀어진다:
 *  - `weekIndexOf`(시작일 앵커) — **백엔드/시트 row 매핑 정본**. 수강시작일 당일 = 1주차,
 *    +7일 = 2주차. lib/repo/sales.ts 좌표 산술·통계 집계가 이 기준.
 *  - `friWeekIndexOf`(금~목 앵커) — **UI 표시/네비 정본**. 한 주 = 금요일~목요일
 *    (숙제검사 목요일 마감). courseStart 를 포함하는 금~목 주 = 1주차.
 *    컨택·일정 탭 헤더가 이 기준 (courseStart 가 금요일이면 두 앵커는 일치).
 *
 * ops 스크립트(.mjs — TS import 불가)는 이 파일의 사본을 갖되
 * `WEEK-INDEX-SSOT-COPY` 마커 의무 (G8 이 마커 없는 사본을 차단).
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

/** 두 날짜의 일수 차이 (양수 또는 음수). DST 오차는 round 로 흡수. */
export function diffDays(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/**
 * [시작일 앵커] 수강시작일 기준 주차. 시작 전 = 0, 당일 = 1주차, +7일 = 2주차 …
 * 시트 영업관리 row 매핑(salesRowFor)·통계 집계의 정본. 상한 없음 —
 * 물리/정책 상한은 호출부가 MAX_SHEET_WEEK/STATS_WEEKS(@/config/cohort-dates)로 가드.
 */
export function weekIndexOf(date: Date, courseStart: Date): number {
  const diff = diffDays(date, courseStart);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

/** [시작일 앵커] 그 주차의 시작일 (수강시작일과 같은 요일). */
export function weekStartOf(date: Date, courseStart: Date): Date {
  const week = weekIndexOf(date, courseStart);
  if (week === 0) return courseStart;
  return addDays(courseStart, (week - 1) * 7);
}

/** 주어진 날짜를 포함하는 주의 금요일 반환 (금~목 주 기준).
 *  JS getDay(): 0=일 … 5=금. offset to last Friday: 금=0/토=1/…/목=6 */
export function friOf(d: Date): Date {
  const dow = d.getDay();
  const offset = (dow + 2) % 7;
  return addDays(d, -offset);
}

/** [금~목 앵커] UI 주차 — courseStart 를 포함하는 금~목 주가 1주차. 시작 전 = 0. */
export function friWeekIndexOf(date: Date, courseStart: Date): number {
  const csFri = friOf(courseStart);
  const dateFri = friOf(date);
  const diff = diffDays(dateFri, csFri);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

/** [금~목 앵커] 그 주차의 첫 날(금요일). */
export function friWeekStartOf(date: Date, courseStart: Date): Date {
  const w = friWeekIndexOf(date, courseStart);
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
