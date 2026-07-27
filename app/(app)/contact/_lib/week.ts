/**
 * 컨택탭 주차 네비 유틸 — 정본은 lib/util/week.ts (R4 W1-0 단일화, G8).
 * 이 탭의 주차는 **UI(금~목) 앵커** — friWeekIndexOf 를 weekIndexOf 이름으로 재수출
 * (호출부 API 보존). 백엔드(시트 row)와 앵커가 다름에 주의: lib/util/week.ts 헤더 참조.
 */
export {
  fmtISO,
  parseISO,
  diffDays,
  addDays,
  friOf,
  friWeekIndexOf as weekIndexOf,
  friWeekStartOf as weekStartOf,
  dayLabelKO,
  fmtMD,
} from "@/util/week";

import { diffDays as diffDaysUtil } from "@/util/week";
import { EDIT_WINDOW_DAYS } from "@/config/cohort-dates";

export function inEditPeriod(date: Date, courseStart: Date): boolean {
  const diff = diffDaysUtil(date, courseStart);
  return diff >= 0 && diff <= EDIT_WINDOW_DAYS; // 8주 + 2주 마감유예
}
