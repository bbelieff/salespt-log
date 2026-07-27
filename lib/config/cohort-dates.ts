/**
 * Layer: config — 기간·날짜 정책 상수 SSOT (R4 W1-0 공용부 계약).
 *
 * 이 파일 밖에서 아래 매직값(50/57/69/10/8)을 다시 하드코딩하면
 * `tests/structural/period-hardcode.test.ts` (G1~G8) 가 실패한다.
 *
 * ⚠️ 세 가지 서로 다른 상한을 혼동하지 말 것 (r4-hardcode-inventory §5-1 핵심 리스크):
 *  - **물리 상한** MAX_SHEET_WEEK(10) — 시트 영업관리 블록이 물리적으로 10주까지만 존재.
 *    좌표 산술(salesRowFor)이 이 밖에서 throw. 무제한(R4)은 DB 정본 전환/템플릿 확장 필요.
 *  - **정책 상한** EDIT_WINDOW_DAYS(69) — 편집 유예(8주 + 2주 마감유예). CLAUDE.md §2.5.
 *  - **통계 창** STATS_WEEKS(8) — 퍼널/스킬/주차별 집계는 8주 기준(유예 주는 별도). CLAUDE.md §2.5.
 */

/**
 * 종강총회 offset (7기+ 현행): O2 = O1 + 50일. ADR-0005.
 * production 은 시트 O2 **직접값**이 진실 — 이 상수는 fixture/진단 전용.
 */
export const GRADUATION_OFFSET_DAYS = 50;

/** 6기 이하 legacy: O2 = O1 + 57일 (ADR-0005). 역시 O2 직접값이 진실. */
export const GRADUATION_OFFSET_DAYS_LEGACY = 57;

/** 시트 진단(sheet-diagnostics)이 허용하는 O2−O1 offset 집합. */
export const ALLOWED_GRAD_OFFSETS: readonly number[] = [
  GRADUATION_OFFSET_DAYS,
  GRADUATION_OFFSET_DAYS_LEGACY,
];

/** 편집 가능 기간 = 수강시작일 + 69일 (8주 + 2주 마감유예). CLAUDE.md §2.5. */
export const EDIT_WINDOW_DAYS = 69;

/**
 * 시트 영업관리 블록의 물리 주차 상한 (1~10주).
 * blockStart + (week-1)*blockStride 좌표 산술이 유효한 범위 — 정책이 아니라 시트 구조.
 */
export const MAX_SHEET_WEEK = 10;

/** 통계(퍼널·주차별 집계·전광판) 창 = 8주. 유예 주(9~10)는 통계 밖. CLAUDE.md §2.5. */
export const STATS_WEEKS = 8;
