/**
 * Layer: repo (순수) — 시트 제목 토큰 매칭 로직. googleapis 의존 0 → 단위 테스트 용이.
 * findSheetByNameContainsAll(drive-client) 의 판정부를 분리.
 */

/**
 * 제목이 **모든 토큰**을 포함하는지.
 *  - 기수 토큰(`\d+기`)은 숫자 경계 정규식 `(^|[^0-9])N기` 로 검증 → "8기"가 "18기"에
 *    오매칭되지 않음.
 *  - 그 외 토큰은 단순 `.includes`.
 */
export function sheetTitleMatchesTokens(title: string, tokens: string[]): boolean {
  const clean = tokens.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return false;
  return clean.every((t) => {
    const m = t.match(/^(\d+)기$/);
    if (m) return new RegExp(`(^|[^0-9])${m[1]}기`).test(title);
    return title.includes(t);
  });
}

/**
 * Drive 검색 후보들 중 토큰을 모두 포함하는 시트 1개 고르기.
 *  - 0개 → null. 정확히 1개 → id. 2개+ → 모호 → null(추측 금지).
 *  - 단, "수강생" 포함형이 정확히 1개면 그것 우선(약한 tiebreak).
 */
export function pickSheetFromCandidates(
  candidates: { id: string; name: string }[],
  tokens: string[],
): string | null {
  const matched = candidates.filter((c) => sheetTitleMatchesTokens(c.name, tokens));
  const uniq = Array.from(new Map(matched.map((f) => [f.id, f])).values());
  if (uniq.length === 0) return null;
  if (uniq.length === 1) return uniq[0]!.id;
  const withSugang = uniq.filter((f) => f.name.includes("수강생"));
  if (withSugang.length === 1) return withSugang[0]!.id;
  return null;
}
