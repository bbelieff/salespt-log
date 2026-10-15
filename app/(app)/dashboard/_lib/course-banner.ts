/**
 * 대시보드 진행도 줄(DashboardProgressBanner) 계산 — 순수 함수(테스트 가능).
 *
 * 기준일 = **종강총회일**(belie 2026-10-15 결정 D1). 화면 라벨·D-day·"수료" 판정·진행바 끝이 모두
 * 같은 날을 본다. 10기+ 는 12주 마지막 날(수강 종료)이 총회보다 며칠 뒤일 수 있는데, 예전에는 D-day 만
 * 12주 끝을 세서 총회 다음 날부터 "총회 지났는데 D-3" 으로 보였다. 총회일이 없을 때만 수강 종료일로.
 * 수료 뒤에는 "수료 후 N주"(D2) — 수료 후에도 계속 쓰는 무제한 CRM(ADR-0031).
 */
import { ceremonyISO, courseEndISO, isExtendedCourseCohort } from "@/config/cohort-dates";
import { addDays, parseISO, weekIndexOf } from "@/util/week";

export function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = toISO.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export type CourseBanner =
  | { hasDates: false }
  | {
      hasDates: true;
      currentWeek: number;
      graduated: boolean;
      /** 수료 다음 날 = 1주, 8일째 = 2주 … (수료 전 0). */
      weeksAfterGraduation: number;
      progressPercent: number;
      /** D-day·라벨·진행바 끝이 함께 보는 날(총회일, 없으면 수강 종료일). */
      endISO: string;
    };

export function computeCourseBanner(p: {
  courseStartISO: string | undefined;
  graduationISO: string | undefined;
  cohort: string | undefined;
  todayISO: string;
  weeks: number;
}): CourseBanner {
  const start = p.courseStartISO;
  if (!start) return { hasDates: false };
  const ceremony = ceremonyISO(start, p.cohort) || p.graduationISO || "";
  const courseEnd = isExtendedCourseCohort(p.cohort) ? courseEndISO(start, p.cohort) : ceremony;
  const endISO = ceremony || courseEnd;
  if (!endISO) return { hasDates: false };
  const total = daysBetween(start, endISO);
  const elapsed = daysBetween(start, p.todayISO);
  const sinceEnd = daysBetween(endISO, p.todayISO);
  const graduated = sinceEnd > 0;
  const actualWeek = weekIndexOf(parseISO(p.todayISO), parseISO(start));
  return {
    hasDates: true,
    currentWeek: Math.max(1, Math.min(p.weeks, actualWeek)),
    graduated,
    // 수료 다음 날을 1주차 시작으로 보는 주차 — 주차 계산 정본(weekIndexOf) 재사용.
    weeksAfterGraduation: graduated ? weekIndexOf(parseISO(p.todayISO), addDays(parseISO(endISO), 1)) : 0,
    progressPercent: total > 0 ? Math.max(0, Math.min(100, (elapsed / total) * 100)) : 0,
    endISO,
  };
}
