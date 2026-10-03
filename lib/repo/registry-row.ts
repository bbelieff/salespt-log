/**
 * Layer: repo — 레지스트리 결정적 append 좌표 계산 (single source, no deps).
 *
 * `values.append` 는 Sheets 가 "테이블" 범위를 자체 탐지해 엉뚱한 열에 쓰는 사고를
 * 낸다(claim-append-columns 2026-06-14 · arena-season2-batch S~AL 2026-08-05).
 * 모든 레지스트리(users·cohorts) 쓰기는 이 함수로 다음 행 번호를 계산해
 * `values.update(range: "A{n}")` 로 결정적 좌표에 쓴다.
 */
export function nextRegistryRowNumber(existingDataRows: number): number {
  return existingDataRows + 2;
}
