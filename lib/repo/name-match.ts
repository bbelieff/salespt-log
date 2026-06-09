/**
 * Layer: repo — 부부(괄호 표기) 이름 매칭 (순수, googleapis 미사용).
 *
 * 아레나 부부 참가자는 레지스트리에 표시이름 `류서하(심나영)` (두 이름)으로 저장.
 * 클레임 시 본인이 둘 중 한 이름만 입력해도 매칭되도록, 저장값을
 * {전체, 앞이름, 뒤이름} 후보로 펼쳐 입력값과 비교한다.
 *
 * 비부부(괄호 없음)는 후보=[전체] 1개 → 기존 정확 일치와 동일(무회귀).
 */

/** "류서하(심나영)" → ["류서하(심나영)", "류서하", "심나영"]. 괄호 없으면 [전체]. */
export function nameMatchCandidates(stored: string): string[] {
  const s = String(stored).trim();
  const m = s.match(/^(.+?)\s*\(\s*(.+?)\s*\)\s*$/);
  if (m) {
    return [s, m[1]!.trim(), m[2]!.trim()].filter(Boolean);
  }
  return s ? [s] : [];
}

/** 저장 이름이 입력 이름과 매칭되는가 (부부면 둘 중 하나도 매칭). */
export function nameMatches(stored: string, input: string): boolean {
  const inp = String(input).trim();
  if (!inp) return false;
  return nameMatchCandidates(stored).includes(inp);
}
