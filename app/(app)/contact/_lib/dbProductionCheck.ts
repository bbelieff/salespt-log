/**
 * dbProductionCheck — 컨택탭 저장 시 채널별 production vs DB 일치 검증.
 * (2026-05-17 [C-2]).
 *
 * 현수막은 검증 대상 아님 ([DB-2] — 게시한날=생산).
 */
import type { Channel } from "@/types";
import type { DBOverview } from "@/service";

export interface ProductionMismatch {
  channel: Channel;
  expected: number; // 컨택탭 입력 production
  actual: number; // DB 시트 합
}

export interface ChannelDraftLike {
  production: number;
}

/**
 * 첫 번째 mismatch 반환. 없으면 null.
 * 검증 룰:
 *  - 매입DB: sum(purchase.주문개수 where 구매일=date)
 *  - 직접생산: sum(production.생산개수 where 날짜=date)
 *  - 콜·지·기·소: count(lead where 접수일=date)
 *  - 현수막: 검증 안 함
 */
export function findProductionMismatch(
  data: DBOverview,
  date: string,
  draft: Record<Channel, ChannelDraftLike>,
): ProductionMismatch | null {
  const checks: Array<{ ch: Channel; dbSum: number }> = [
    {
      ch: "매입DB",
      dbSum: data.purchases
        .filter((p) => p.구매일 === date)
        .reduce((s, p) => s + (p.주문개수 || 0), 0),
    },
    {
      ch: "직접생산",
      dbSum: data.productions
        .filter((p) => p.날짜 === date)
        .reduce((s, p) => s + (p.생산개수 || 0), 0),
    },
    {
      ch: "콜·지·기·소",
      dbSum: data.leads.filter((l) => l.접수일 === date).length,
    },
  ];
  for (const { ch, dbSum } of checks) {
    const expected = draft[ch].production;
    if (expected > 0 && expected !== dbSum) {
      return { channel: ch, expected, actual: dbSum };
    }
  }
  return null;
}
