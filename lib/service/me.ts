/**
 * Layer: service — 사용자 프로필 + 수강 일정 (헤더 표시용).
 *
 * SSOT:
 *  - 마스터 레지스트리 users 탭 → email/spreadsheetId 매핑.
 *  - 사용자 개인 시트 01 영업관리!B3:C3 → 기수/이름 (표시값 SSOT).
 *  - 사용자 개인 시트 01 영업관리!N1 → 수강시작일 (D-day 계산 기준).
 *
 * 사용처:
 *  - TopHeader 컴포넌트 — 모든 탭 상단 "{기수} {이름} 대표님" 표시
 *  - D-day 카운트다운 위젯 — 수강시작일 + 49일(7주) target까지 남은 일수
 */
import { findUserByEmail } from "@/repo/users";
import { readProfile } from "@/repo/sales";
import { readCourseStart } from "@/repo/sales";

/** 7주차 D-day = 수강시작일 + 49일. */
const WEEK_TARGET_OFFSET_DAYS = 49;

export interface MeProfile {
  email: string;
  cohort: string; // 예: "7기" (시트 B3)
  name: string; // 예: "김믿음" (시트 C3)
  /** 수강시작일 (YYYY-MM-DD) — N1 셀. D-day 계산 client 기준점. */
  courseStartISO: string;
  /** 수강 7주차 D-day target (YYYY-MM-DD = courseStart + 49d). */
  weekTargetISO: string;
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

export async function loadMe(email: string): Promise<MeProfile> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`[me] 사용자(${email})를 찾을 수 없습니다.`);
  }
  const [profile, courseStart] = await Promise.all([
    readProfile(user.spreadsheetId),
    readCourseStart(user.spreadsheetId),
  ]);
  const target = addDays(courseStart, WEEK_TARGET_OFFSET_DAYS);
  return {
    email: user.email,
    cohort: profile.cohort || user.cohort,
    name: profile.name || user.name,
    courseStartISO: toISO(courseStart),
    weekTargetISO: toISO(target),
  };
}
