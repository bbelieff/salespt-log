/**
 * Layer: service — 아레나 **시즌 SSOT** (AR-2b).
 *
 * "지금 몇 번째 시즌인가"를 판정하는 **단일 결정점**. 전광판 헤더·홈 진입 버튼 등
 * 시즌을 표시하는 모든 화면이 이 함수 하나를 공유한다(각자 파싱하면 드리프트).
 *
 * 원칙 (AR-1 과 동일):
 *  - 시즌 파싱은 `arenaCohortLabelParts`(cohort-token) **재사용** — 신규 파서 금지.
 *  - **시즌 번호·날짜 하드코딩 금지**. 현재 시즌 = 활성 아레나 참가자 cohort 의 **최대 시즌**.
 *    A2 기수가 registry 에 등록되는 순간 시즌2로 자동 전환된다(코드 수정 불필요, 8/7 개막).
 *  - 참가자가 없거나 전부 파싱 실패면 0 = "미상" — 호출부가 fallback 표기를 고른다.
 */
import { arenaCohortLabelParts } from "./cohort-token";

/** 아레나 cohort 라벨 목록 → 현재 시즌 번호. 없으면 0(미상). */
export function resolveCurrentSeason(cohorts: readonly string[]): number {
  let max = 0;
  for (const c of cohorts) {
    const parts = arenaCohortLabelParts(c); // 재사용 파서("A2-1"/"A2-1기" 둘 다)
    if (parts && parts.season > max) max = parts.season;
  }
  return max;
}

/** 시즌 표시 라벨 — 미상(0)이면 시즌 번호를 숨긴 "아레나". 표기 규칙 단일화. */
export function seasonDisplayLabel(season: number): string {
  return season > 0 ? `아레나 시즌${season}` : "아레나";
}
