/**
 * 부가세 역산 헬퍼 (PR-C3 / R4).
 *
 * DB 입력은 "총액 + 개수 + 부가세 포함여부" 로 받고, 저장은 **부가세 제외 개당단가**
 * 한 값만 한다(컬럼 추가 없음). 부가세 포함이면 1.1 로 나눠 공급가로 환산.
 * 순수 함수 — 클라(입력 폼)·서비스 양쪽에서 재사용.
 */

/** 총액·개수·부가세포함여부 → 부가세 제외 개당단가(원, 정수 반올림). */
export function unitPriceFromTotal(
  total: number,
  count: number,
  hasVat: boolean,
): number {
  if (!count || count <= 0) return 0;
  const net = hasVat ? total / 1.1 : total;
  return Math.round(net / count);
}
