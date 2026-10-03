/**
 * Layer: util (순수 — import 0). 0-based 열 인덱스 → 시트 열문자(A, Z, AA, BN …).
 *
 * backfill payload(열문자 키)·carryover payload 가 쓰는 규칙과 같다. 이전 두 곳의 로컬
 * 구현은 AZ(51)까지만 맞았다 — 업체정보 확장(04 AU~BN)이 BA 이후를 쓰므로 일반형으로 통일.
 */
export function colName(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
