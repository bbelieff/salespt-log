/**
 * Layer: repo (상수만 — I/O 없음). 02 계약수납 수납총액 SUMIFS.
 *
 * D3 = 아레나(구분≠이월, carryover-revenue-leak 가드), D4 = 이월(구분=이월,
 * arena-start-revenue-split). Q/W/AC 3슬롯 합산. setup-formulas 가 §2.5 보존가드로
 * 설치하고, 앱 대시보드는 JS(splitContractRevenue)로 동일하게 분리한다.
 */
export const CONTRACT_RECEIVED_FORMULAS = {
  arena:
    '=SUMIFS(Q6:Q,$AI$6:$AI,"<>이월")+SUMIFS(W6:W,$AI$6:$AI,"<>이월")+SUMIFS(AC6:AC,$AI$6:$AI,"<>이월")',
  carryover:
    '=SUMIFS(Q6:Q,$AI$6:$AI,"이월")+SUMIFS(W6:W,$AI$6:$AI,"이월")+SUMIFS(AC6:AC,$AI$6:$AI,"이월")',
} as const;

/**
 * 01 영업관리 O5 = 수수료총합 — **이월제외 수납총액(02!D3)만**. 승인총액(02!D2)은 기록용,
 * 매출 합산에 절대 미포함(매출 = 수임료 + 수납액, 승인 제외 / ADR-0026). 02!D3 한 셀만 참조 →
 * D2 가 어떤 매출식에도 안 들어감. 02 탭명 공백 → 작은따옴표 quoting.
 */
export const SALES_FEE_TOTAL_FORMULA = "='02 계약수납관리'!D3" as const;
