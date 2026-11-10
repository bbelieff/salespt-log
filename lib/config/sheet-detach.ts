/**
 * ADR-0038 5단계 — 시트에서 떼어 낸(detach) 기수. 이 기수 수강생은 시트 번호를 그대로 쓰지만
 * 앱이 그 시트로 미러를 보내지도, 시트에서 보충 읽기를 하지도 않는다(DB 만 정본, 시트는 그 시점에 얼어붙음).
 *
 * 비어 있으면 동작 변화 0. 기수를 넣고 빼는 것은 belie 결정 + PR 1건(되돌리기 = 빼는 PR).
 * 넣기 전 확인(docs/plans/active/sheetless-student-id.md §9):
 *  ① 카페봇이 그 기수 개인 시트로 과제 점수를 매기지 않는가(HW_ACTIVE_COHORTS·JOURNAL_SHEETS 밖)
 *  ② 그 기수 DB↔시트 대조 차이 0(보충 읽기를 끊어도 빠지는 기록이 없다)
 *  ③ 아레나 기수는 넣지 않는다(전광판이 시트를 읽는다)
 */
// 4기 — 2026-11-11 belie 승인. 대조(db-audit cohort-detach-parity, run 42873368119): 시트 1개, 6탭 전부 시트=DB.
//   카페봇 채점 대상 아님(활성 11·12·13), 아레나 공유 0.
export const SHEET_DETACHED_COHORTS: ReadonlySet<string> = new Set<string>(["4"]);
