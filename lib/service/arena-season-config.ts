/**
 * Layer: service — 아레나 **시즌 SSOT** (AR-2b, belie A안 확정 2026-07-30).
 *
 * "지금 몇 번째 시즌인가"(라벨) + "누가 이 시즌 소속인가"(집계 스코프)를 정하는 **단일 결정점**.
 * 전광판 헤더·기수 평균·개인 랭킹·공유왕이 모두 이 함수들을 공유한다 — 각자 판정하면
 * 헤더는 "시즌2"인데 표는 시즌1 인 자기모순이 난다.
 *
 * ## 정본 = cohorts 탭의 admin 입력 (registry K 는 쓰지 않는다)
 * 시즌 개막일은 `cohorts` 탭 시즌 행(label "A{n}", type=arena)의 **J열 seasonStartISO**.
 * admin 이 `/admin/cohorts` 에서 직접 입력한다.
 *
 * ⚠️ 왜 참가자별 `registry K(courseStartISO)` 를 쓰지 않는가 — 3라운드 적대 검증 결론:
 *   K 는 prep 등록 시 **복제된 템플릿 시트의 O1** 에서 스탬프된다(`users-prep.readCachedFromSheet`).
 *   `create-arena-members` 는 `writeCourseDates` 를 호출하지 않으므로, 새 시즌 참가자의 K 에
 *   **이전 시즌 개강일**이 들어간다. 즉 "유효한 과거 날짜"처럼 보여 개막 판정이 통과하고,
 *   시즌이 데이터 스코프까지 정하는 지금 구조에서는 로스터 생성만으로 옛 시즌 보드가 사라진다.
 *   출처를 신뢰할 수 없는 값이라 시즌 판정에서 완전히 배제한다.
 *
 * ## 판정 규칙
 *  - 현재 시즌 = `seasonStartISO` 가 유효 ISO 이고 **오늘 이하**인 아레나 시즌 중 최대.
 *  - 미입력·비ISO·미래 → 그 시즌은 아직 개막 아님(등록 ≠ 개막).
 *  - archived 시즌은 제외 — admin 이 명시적으로 닫은 시즌.
 *  - 아무 시즌도 확정되지 않으면 0(미상) → 라벨은 번호 없이 "아레나", 스코프는 전부 통과해
 *    **데이터를 자르지 않는다**. 틀린 번호로 실데이터를 감추는 것보다 안전하다.
 *  - 오늘 날짜는 호출부가 주입(순수함수 유지 → 테스트 가능, 앱 코드 날짜 하드코딩 0).
 */
import { arenaCohortLabelParts, arenaSeasonLabelParts } from "./cohort-token";

/** 시즌 판정 입력 — cohorts 탭 시즌 행에서 필요한 최소 필드(Cohort 를 그대로 넘길 수 있다). */
export interface ArenaSeasonRow {
  /** 시즌 레벨 라벨 "A{n}". */
  label: string;
  /** "active" | "archived" — archived 는 판정 제외. */
  status?: string;
  /** cohorts J열. 빈값 = 개막일 미정. */
  seasonStartISO?: string;
  /** cohorts D열. "arena" 만 시즌 판정 대상. */
  type?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 현재 시즌 번호 — 개막일이 지난 활성 아레나 시즌 중 최대. 확정 불가면 0(미상).
 * @param rows cohorts 탭 행들(일반 기수 섞여 있어도 됨 — type/label 로 걸러낸다)
 * @param todayISO 오늘(YYYY-MM-DD). KST 기준 값을 호출부가 주입한다.
 */
export function resolveCurrentSeason(
  rows: readonly ArenaSeasonRow[],
  todayISO: string,
): number {
  if (!ISO.test(todayISO)) return 0; // 오늘을 모르면 판정 불가 — 미상으로 degrade
  let opened = 0; // 개막이 확정된 최대 시즌
  let unknown = 0; // 개강일 **미입력·비ISO**(= 개막 여부를 모름)인 최대 시즌
  for (const r of rows) {
    if (r.status === "archived") continue; // admin 이 닫은 시즌
    const season = arenaSeasonLabelParts(r.label); // "A2" → 2 (시즌 레벨 라벨만)
    if (season === null) continue; // 일반 기수("8")·참가자 라벨("A2-1기") 무시
    if (r.type !== undefined && r.type !== "arena") continue;
    const start = (r.seasonStartISO ?? "").trim();
    if (!ISO.test(start)) {
      // "모름" — "아직 개막 안 함"(미래 날짜)과 반드시 구분한다.
      if (season > unknown) unknown = season;
      continue;
    }
    if (start > todayISO) continue; // "아직" — 판정된 미개막이라 옛 시즌 유지가 맞다
    if (season > opened) opened = season;
  }
  // 더 높은 시즌의 개막 여부를 **모르면** 옛 시즌으로 고정하지 않는다 → 0(미상).
  // 고정하면 그 시즌 스코프가 새 시즌 참가자를 통째로 숨긴다(3R HIGH).
  return unknown > opened ? 0 : opened;
}

/**
 * 집계 스코프 — 참가자 cohort("A2-1기")가 해당 시즌 소속인가.
 * season<=0(미상)이면 **전부 통과** — 시즌을 못 정했을 때 보드를 비우지 않는다.
 */
export function isInSeason(cohort: string, season: number): boolean {
  if (season <= 0) return true;
  return arenaCohortLabelParts(cohort)?.season === season;
}

/** 시즌 표시 라벨 — 미상(0)이면 시즌 번호를 숨긴 "아레나". 표기 규칙 단일화. */
export function seasonDisplayLabel(season: number): string {
  return season > 0 ? `아레나 시즌${season}` : "아레나";
}
