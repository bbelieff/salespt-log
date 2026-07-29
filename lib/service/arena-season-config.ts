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
 * 현재 시즌 판정 = **개막이 날짜로 확인된** 시즌만 채택 (등록·존재만으로는 안 넘어간다):
 *  - 사전등록(prep)·테스터 행은 개막 전에 미리 만들어진다. 등록만으로 시즌을 넘기면
 *    개막 전에 전광판이 "시즌2"로 뒤집히고, 집계 스코프까지 시즌2가 되어 **살아있는
 *    시즌1 보드가 통째로 사라진다**(적대리뷰 HIGH — 라벨만 틀리던 것보다 훨씬 나쁨).
 *  - 그래서 `courseStartISO`(registry K)가 **오늘 이하**인 기수만 "개막"으로 인정한다.
 *  - ⚠️ 아레나 행은 K 가 비어 있을 수 있다 — `create-arena-members` 가 개강일을 쓰지 않는다
 *    (`create-cohort-members` 와 달리 writeCourseDates 미호출 → prep 스탬프가 "" 로 남음).
 *    그래서 **날짜 미상은 시즌을 올리지 못한다**(fail-closed). 전부 미상이면 0 = 미상 →
 *    라벨은 번호 없이 "아레나", 스코프는 전부 통과 → **데이터를 자르지 않는다**.
 *    틀린 시즌 번호로 실데이터를 감추는 것보다 번호를 감추는 쪽이 안전하다.
 *  - 테스터(A{n}-0)는 참가자가 아니므로(cohortCategory=테스트) 시즌을 넘기지 못한다.
 */
import { arenaCohortLabelParts } from "./cohort-token";

/** 시즌 판정에 필요한 최소 필드 — User 를 그대로 넘길 수 있다. */
export interface SeasonParticipant {
  cohort: string;
  courseStartISO?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** 개막이 **날짜로 확인**됐는가 — 개강일이 유효 ISO 이고 오늘 이하. 미상이면 false(불인정). */
function openedByDate(courseStartISO: string | undefined, todayISO: string): boolean {
  const s = (courseStartISO ?? "").trim();
  if (!ISO.test(s) || !ISO.test(todayISO)) return false; // 미상 → 판정 불가(시즌 못 올림)
  return s <= todayISO;
}

/**
 * 현재 시즌 번호 — **개막이 확인된** 아레나 기수 중 최대 시즌. 확인 불가면 0(미상).
 *
 * 0 의 의미 = "시즌을 단정하지 않는다": 라벨은 "아레나"(번호 생략), 집계 스코프는
 * `isInSeason` 이 전부 통과시켜 **데이터를 자르지 않는다**. 틀린 번호로 실데이터를
 * 감추는 것보다 안전하다(개강일 미기록 아레나 행 때문에 실제로 발생 가능한 상태).
 *
 * @param todayISO 오늘 날짜(YYYY-MM-DD). 호출부 주입 — 하드코딩·내부 Date 사용 금지.
 */
export function resolveCurrentSeason(
  parts: readonly SeasonParticipant[],
  todayISO: string,
): number {
  let opened = 0;
  for (const p of parts) {
    const t = arenaCohortLabelParts(p.cohort); // 재사용 파서("A2-1"/"A2-1기" 둘 다)
    if (!t) continue;
    if (t.gisu === 0) continue; // 테스터 — 스모크테스트 1행이 시즌을 넘기지 못하게
    if (!openedByDate(p.courseStartISO, todayISO)) continue; // 미개막·날짜 미상 → 불인정
    if (t.season > opened) opened = t.season;
  }
  return opened;
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
