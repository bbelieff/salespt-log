/**
 * Layer: service — 아레나 **시즌 SSOT** (AR-2b).
 *
 * "지금 몇 번째 시즌인가"(라벨) + "누가 이 시즌 소속인가"(집계 스코프)를 결정하는 **단일 결정점**.
 * 전광판 헤더·기수 평균·개인 랭킹·공유왕이 모두 이 두 함수를 공유한다 — 각자 판정하면
 * 헤더는 "시즌2"인데 표는 시즌1 데이터인 자기모순이 난다(적대 리뷰 HIGH).
 *
 * 원칙 (AR-1 승계):
 *  - 시즌 파싱은 `arenaCohortLabelParts`(cohort-token) **재사용** — 신규 파서 금지.
 *  - **시즌 번호·날짜 하드코딩 0**. 오늘 날짜는 호출부가 주입(순수함수 유지 → 테스트 가능).
 *
 * 현재 시즌 판정 = **등록이 아니라 개막** 기준:
 *  - 사전등록(prep)·테스터 행은 개막 전에 미리 만들어진다. 등록만으로 시즌을 넘기면
 *    개막 전에 전광판이 "시즌2"로 뒤집히고, 집계 스코프까지 시즌2가 되어 **보드가 빈다**.
 *  - 그래서 `courseStartISO`(registry K)가 **오늘 이후**인 기수는 아직 개막 전 → 제외.
 *  - 테스터(A{n}-0)는 참가자가 아니므로(cohortCategory=테스트) 시즌을 넘기지 못한다.
 *  - 날짜가 비었거나 ISO 가 아니면 **포함**(옛 동작으로 안전 degrade — 판정 불가 시 보수적).
 */
import { arenaCohortLabelParts } from "./cohort-token";

/** 시즌 판정에 필요한 최소 필드 — User 를 그대로 넘길 수 있다. */
export interface SeasonParticipant {
  cohort: string;
  courseStartISO?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** 아직 개막 전인가 — 개강일이 오늘보다 뒤. 날짜 미상이면 false(개막한 것으로 취급). */
function notYetOpened(courseStartISO: string | undefined, todayISO: string): boolean {
  const s = (courseStartISO ?? "").trim();
  if (!ISO.test(s) || !ISO.test(todayISO)) return false;
  return s > todayISO;
}

/**
 * 현재 시즌 번호 — **개막한** 아레나 기수 중 최대 시즌. 없으면 0(미상).
 * @param todayISO 오늘 날짜(YYYY-MM-DD). 호출부 주입 — 하드코딩·내부 Date 사용 금지.
 */
export function resolveCurrentSeason(
  parts: readonly SeasonParticipant[],
  todayISO: string,
): number {
  let max = 0;
  for (const p of parts) {
    const t = arenaCohortLabelParts(p.cohort); // 재사용 파서("A2-1"/"A2-1기" 둘 다)
    if (!t) continue;
    if (t.gisu === 0) continue; // 테스터 — 스모크테스트 1행이 시즌을 넘기지 못하게
    if (notYetOpened(p.courseStartISO, todayISO)) continue; // 사전등록 ≠ 개막
    if (t.season > max) max = t.season;
  }
  return max;
}

/**
 * 집계 스코프 — 이 cohort 가 해당 시즌 소속인가.
 * season<=0(미상)이면 **전부 통과** — 시즌을 못 정했을 때 보드를 비우지 않는다(degrade).
 */
export function isInSeason(cohort: string, season: number): boolean {
  if (season <= 0) return true;
  return arenaCohortLabelParts(cohort)?.season === season;
}

/** 시즌 표시 라벨 — 미상(0)이면 시즌 번호를 숨긴 "아레나". 표기 규칙 단일화. */
export function seasonDisplayLabel(season: number): string {
  return season > 0 ? `아레나 시즌${season}` : "아레나";
}
