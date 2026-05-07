/**
 * Layer: service — 사용자 프로필 + 수강 일정 (헤더 표시용).
 *
 * SSOT:
 *  - 마스터 레지스트리 users 탭 → email/spreadsheetId 매핑.
 *  - 사용자 개인 시트 01 영업관리!B3:C3 → 기수/이름 (표시값 SSOT).
 *  - 사용자 개인 시트 01 영업관리!N1 → 수강시작일 (1주차 시작, 금요일).
 *  - 종강총회일 (= 수료일, 같은 날, 토요일) = N1 + 57일.
 *
 * 사용처:
 *  - TopHeader 컴포넌트 — 모든 탭 상단 "{기수} {이름} 대표님" 표시
 *  - DDayBadge — 종강총회일까지 남은 일수 카운트다운
 */
import { findUserByEmail } from "@/repo/users";
import { readProfile } from "@/repo/sales";
import { readCourseStart } from "@/repo/sales";

/**
 * 종강총회일 = 수강시작일 + 57일 (토요일).
 * = 수료일과 같은 날. data-model.md §D-day 계산 규칙 SSOT.
 *
 * 검증 (6기): N1=2026-04-10(금) → +57d = 2026-06-06(토) ✓
 */
export const GRADUATION_OFFSET_DAYS = 57;

export interface MeProfile {
  email: string;
  cohort: string; // 예: "6기" (시트 B3, formatCohort 정규화)
  name: string; // 예: "김믿음" (시트 C3)
  /** 수강시작일 (YYYY-MM-DD) — N1 셀. 1주차 시작 (금요일). */
  courseStartISO: string;
  /** 종강총회일 = 수료일 (YYYY-MM-DD = courseStart + 57d, 토). */
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

/** 테스트용 export — 외부에선 loadMe() 사용. */
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
  const [profile, courseStart] = await Promise.all([
    readProfile(user.spreadsheetId),
    readCourseStart(user.spreadsheetId),
  ]);
  const graduation = addDays(courseStart, GRADUATION_OFFSET_DAYS);
  return {
    email: user.email,
    cohort: profile.cohort || user.cohort,
    name: profile.name || user.name,
    courseStartISO: toISO(courseStart),
    graduationISO: toISO(graduation),
  };
}
