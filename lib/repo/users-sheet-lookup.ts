/**
 * Layer: repo — Drive 파일명으로 미등록 수강생 시트 찾기.
 * users.ts 에서 분리(500줄 cap, BBE-55). 호환 위해 users.ts 가 그대로 re-export 한다.
 */
import { findSheetByExactName, findSheetByNameContainsAll } from "./drive-client";

/**
 * Drive 파일명 검색 — 미등록 시트 찾기(미등록 fallback. 등록자는 findExistingSheetIdByCohortName).
 *  - 아레나(A{n}-{m}기): `세일즈PT_A{n}_{m}기 {name}_대표님 경영일지` exact → 토큰 contains.
 *  - 일반: `세일즈PT_ {N}기 {name} 수강생 경영일지` exact → "수강생" 무관 토큰 contains.
 *    숫자경계 가드("8기"≠"18기"), 2개+ 모호면 null. cohort=T → null(검색 안 함).
 */
export async function findSheetByCohortName(
  cohort: string,
  name: string,
): Promise<string | null> {
  if (String(cohort).trim().toUpperCase() === "T") return null;
  const cleanName = name.trim();

  // 아레나(A{n}-{m}기) → "세일즈PT_A{n}_{m}기 {이름}_대표님 경영일지". 부부는 토큰 contains 로 흡수.
  const arena = String(cohort).trim().match(/^A(\d+)-(\d+)기?$/);
  if (arena) {
    const [, season, gisu] = arena;
    const exactArena = `세일즈PT_A${season}_${gisu}기 ${cleanName}_대표님 경영일지`;
    const ex = await findSheetByExactName(exactArena);
    if (ex) return ex;
    return findSheetByNameContainsAll([
      "세일즈PT",
      `A${season}_${gisu}기`,
      cleanName,
      "대표님",
      "경영일지",
    ]);
  }

  const cohortNum = String(cohort).replace(/기\s*$/, "").trim();
  const exactName = `세일즈PT_ ${cohortNum}기 ${cleanName} 수강생 경영일지`;
  const exact = await findSheetByExactName(exactName);
  if (exact) return exact;
  // exact 실패 → "수강생" 유무 무관 토큰 포함 매칭.
  return findSheetByNameContainsAll([
    "세일즈PT",
    `${cohortNum}기`,
    cleanName,
    "경영일지",
  ]);
}
