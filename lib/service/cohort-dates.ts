/**
 * Layer: service — 기수 날짜 계산·입력 해석·기록결과 분류 (순수). R3-5.
 *
 * O1(수강시작일)·O2(종강총회=수료일)의 관계는 ADR-0005:
 *   종강총회 = 수강시작 + 50일 (7기+ 현행). 6기 이하 legacy 는 +57.
 *   진실은 시트 O2 **직접값** — 그래서 코드는 O2 를 수식에 의존하지 않고 리터럴로 확정한다.
 */

/** ADR-0005: 7기+ 종강총회 offset. 정본 = @/config/cohort-dates (R4 W1-0) — 소비처 위해 재수출. */
export { GRADUATION_OFFSET_DAYS } from "@/config/cohort-dates";
import { GRADUATION_OFFSET_DAYS } from "@/config/cohort-dates";

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

/**
 * 제출 시 **실제로 보낼 수강시작일** 확정 — 폼 state 우선, 비었으면 input 의 DOM value 폴백.
 *
 * 왜 폴백이 필요한가: `<input type="date">` 는 정상 controlled input 이지만, **자동화(브라우저
 * 조작)나 일부 자동완성은 DOM `.value` 를 직접 세팅**해 React onChange 를 발화시키지 않는다.
 * 그러면 state 는 빈 채로 제출되고 서버는 "날짜 없음 → 시트 값 유지" 경로를 타 템플릿(이전 기수)
 * 날짜가 새 시트에 그대로 남는다 — 실제로 2회 발생한 사고(연습용2·10기 6명).
 *
 * 형식 검증은 하지 않는다(서버 400 이 정본). 빈값이면 "" — 호출부가 "날짜 없음"으로 처리.
 */
export function resolveCourseStartInput(
  stateValue: string,
  domValue: string,
): string {
  const fromState = String(stateValue ?? "").trim();
  if (fromState) return fromState;
  return String(domValue ?? "").trim();
}

/** 새 시트 O1/O2 기록 결과 — 생성 리포트에 그대로 실려 화면에 표시된다. */
export type CourseDateStatus = "written" | "preserved" | "no_input" | "error";

/**
 * writeCourseDates 결과 + 입력값 → 운영자에게 보여줄 상태 1개로 분류 (순수).
 *   written   — 입력 날짜가 O1/O2 에 실제로 기록됨 (정상)
 *   no_input  — 날짜 미입력 → 시트(=템플릿 복제본) 값 유지 ★사고 2회의 그 경로
 *   preserved — 날짜는 왔는데 §2.5 보존 가드가 기존값을 지킴 → 입력 미반영
 *   error     — 기록 시도가 예외로 실패 (생성 자체는 성공)
 */
export function classifyCourseDateOutcome(input: {
  courseStartISO: string;
  written: string[];
  error?: string;
}): CourseDateStatus {
  if (input.error) return "error";
  if (!String(input.courseStartISO ?? "").trim()) return "no_input";
  return input.written.length > 0 ? "written" : "preserved";
}

/**
 * 시트를 실측 readback 해서 리포트에 담아야 하는가.
 * "기록됨"이 아닌 모든 경우 = 시트에 템플릿 잔재가 남아있을 수 있는 경우 → 실제 값을 읽어
 * 화면에 보여준다. 정상 경로에서는 추가 시트 read 를 하지 않는다.
 */
export function needsSheetReadback(status: CourseDateStatus): boolean {
  return status !== "written";
}
