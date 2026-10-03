/**
 * document-ocr/amount — 문서 파서 공용 원 금액 표기.
 *
 * - groupThousands: 원 단위 숫자 쉼표(임차보증금·월세 칸, 비교표의 "원문 250,123,456원").
 * - [재무] 금액 칸은 백만원 정본(@/util/company-money wonToMillion — company-finance-won-grid 2026-09-28).
 *   옛 "3,200만"(formatManwon)·"250백만"(formatBaekman) 표기는 더 쓰지 않아 지웠다.
 */

/** 정수 부분에 천 단위 쉼표(부호 유지). */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
