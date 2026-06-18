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
