/**
 * 일정·계약 탭 주차 유틸 — 정본은 lib/util/week.ts (R4 W1-0 단일화, G8).
 * 이 탭의 주차는 **UI(금~목) 앵커** — friWeekIndexOf 를 weekIndexOf 이름으로 재수출
 * (호출부 API 보존).
 *
 * ⚠️ 백엔드(lib/repo/sales.ts)는 시작일 앵커(weekIndexOf) — 시트 row 매핑 보존.
 *    UI 는 금~목 기준으로 표시·네비게이션. 상세: lib/util/week.ts 헤더.
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
