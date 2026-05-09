/**
 * Layer: service — 사용자 프로필 + 수강 일정 (헤더 표시용).
 *
 * SSOT:
 *  - 마스터 레지스트리 users 탭 → email/spreadsheetId 매핑.
 *  - 사용자 개인 시트 01 영업관리!B3:C3 → 기수/이름 (표시값 SSOT).
 *  - 사용자 개인 시트 01 영업관리!O1 → 수강시작일 (1주차 시작, 금요일).
 *  - **사용자 개인 시트 01 영업관리!O2 → 종강총회일 (= 수료일, 토요일)**
 *    시트는 보통 `=O1+57` 수식이거나 직접 입력. 코드는 그대로 읽기만.
 *
 * 사용처:
 *  - TopHeader 컴포넌트 — 모든 탭 상단 "{기수} {이름} 대표님" 표시
 *  - DDayBadge — 종강총회일(O2)까지 남은 일수 카운트다운 (D-N = O2 − today)
 */
import { findUserByEmail } from "@/repo/users";
import { readProfile, readCourseStart, readGraduation } from "@/repo/sales";

/**
 * 참고 상수: 시트 O2가 보통 `=O1+57` 수식인 경우의 offset.
 * 코드는 O2를 직접 읽으므로 이 값을 사용하지 않지만, fixture 테스트에서 검증용으로 유지.
 */
export const GRADUATION_OFFSET_DAYS = 57;

export interface MeProfile {
  email: string;
  cohort: string; // 예: "6기" (시트 B3, formatCohort 정규화)
  name: string; // 예: "김믿음" (시트 C3)
  /** 수강시작일 (YYYY-MM-DD) — O1 셀. 1주차 시작 (금요일). */
  courseStartISO: string;
  /** 종강총회일 = 수료일 (YYYY-MM-DD) — **O2 직접 읽기** (시트 수식 또는 직접 입력). */
  graduationISO: string;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + days);
  return next;
}

/**
 * 테스트용 export — 시트 O2가 `=O1+57` 가정에서 graduation 계산.
 * 실제 loadMe()는 O2를 직접 읽으므로 이 함수를 사용하지 않음.
 */
export function computeGraduationISO(courseStartISO: string): string {
  const [y, m, d] = courseStartISO.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const start = new Date(y, m - 1, d);
  return toISO(addDays(start, GRADUATION_OFFSET_DAYS));
}

export async function loadMe(email: string): Promise<MeProfile> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`[me] 사용자(${email})를 찾을 수 없습니다.`);
  }
  // 시트에서 O1, O2를 동시에 읽음 (graduation은 O2 직접 — O1+57 계산 X)
  const [profile, courseStart, graduation] = await Promise.all([
    readProfile(user.spreadsheetId),
    readCourseStart(user.spreadsheetId),
    readGraduation(user.spreadsheetId),
  ]);
  return {
    email: user.email,
    cohort: profile.cohort || user.cohort,
    name: profile.name || user.name,
    courseStartISO: toISO(courseStart),
    graduationISO: toISO(graduation),
  };
}
