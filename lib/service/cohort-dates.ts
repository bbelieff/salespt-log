/**
 * Layer: service — 기수 날짜 계산 (순수). R3-5.
 *
 * O1(수강시작일)·O2(종강총회=수료일)의 관계는 ADR-0005:
 *   종강총회 = 수강시작 + 50일 (7기+ 현행). 6기 이하 legacy 는 +57.
 *   진실은 시트 O2 **직접값** — 그래서 코드는 O2 를 수식에 의존하지 않고 리터럴로 확정한다.
 */

/** ADR-0005: 7기+ 종강총회 offset (수강시작 + 50일). */
export const GRADUATION_OFFSET_DAYS = 50;

/** "YYYY-MM-DD" 형식 + 실재 날짜인지. */
export function isValidISODate(s: string): boolean {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    !Number.isNaN(dt.getTime()) &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * 수강시작 ISO + offset일 → 종강 ISO(YYYY-MM-DD). 입력이 유효 ISO 가 아니면 "".
 * UTC 고정 산술(타임존·서머타임 무관, 결정적).
 */
export function computeGraduationISO(
  startISO: string,
  offsetDays: number = GRADUATION_OFFSET_DAYS,
): string {
  if (!isValidISODate(startISO)) return "";
  const [y, mo, d] = startISO.trim().split("-").map(Number);
  const dt = new Date(Date.UTC(y!, mo! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
