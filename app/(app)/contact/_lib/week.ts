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

// R4 W1-1(ADR-0029 G1 = 편집 완전 해제): `inEditPeriod`(수강시작+EDIT_WINDOW_DAYS 읽기전용
// 판정) 제거. 수료 후에도 편집이 가능해져 이 게이트 자체가 성립하지 않는다.
// (호출처는 이미 0 이었다 — 정책 잔재였고, 되살리려면 ADR-0029 를 supersede 할 것.)
