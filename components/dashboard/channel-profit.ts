/**
 * 영업이익 상세 「채널별 남은 돈」 — 순수 계산·문장 규칙(표시는 ChannelProfitBreakdown).
 * SSOT: docs/design/components.md §9-2 (2026-10-12 #7).
 *
 * 계약 행마다 버킷 하나:
 *  - 4채널 — 대시보드 응답 contractChannels 로 맞춘 연결 미팅의 채널
 *  - manual — 「영업기록 없이 추가」(AK `manual:`) → 실무/수납에서 영업기록을 연결할 수 있다
 *  - unknown — AK 빈 값(이전 계약 직접등록 등)·못 찾은 미팅 → 연결할 화면이 없어 설명만
 *  - pending — 응답에 아직 없는 행(방금 추가·이름 바꾼 계약) → 「영업기록 없음」으로 몰지 않는다
 * 행을 나눠 periodRevenue 를 더하기만 하므로 Σ버킷 매출 = 매출 칸(ADR-0034 §2, 이월·해지 포함).
 * 비용은 세 채널의 기간 DB 비용(periodDbCostByChannel). 추가 비용(원장)은 채널에 나누지 않는다.
 */
import { CHANNEL_ORDER, type Channel, type DashboardContractChannel } from "@/types";
import { formatMoney } from "@/lib/format/money";
import { contractChannelKey, isManualContractLink } from "@/util/contract-link";
import {
  periodDbCostByChannel,
  periodRevenueByBucket,
  type DateRange,
  type DbCostOverview,
  type RevenueContract,
} from "@/util/finance-period";

export type ProfitBucket = Channel | "manual" | "unknown" | "pending";

export interface ChannelProfit {
  key: ProfitBucket;
  /** 기간 안 계약 수(계약일 기준 — 영업이익 상세 「계약 N건」과 같은 정의). */
  contracts: number;
  revenue: number;
  cost: number;
  /** 남은 돈 = 매출 − 비용. */
  left: number;
}

export interface ChannelProfitTable {
  /** 4채널 — CHANNEL_ORDER 고정. 기간 칩을 바꿔도 줄이 움직이지 않는다. */
  channels: ChannelProfit[];
  manual: ChannelProfit;
  unknown: ChannelProfit;
  pending: ChannelProfit;
}

/** 표에 쓰는 계약 행 — /api/contract-payment 행(ContractPayment)이 그대로 맞는다. */
export interface ChannelProfitRow extends RevenueContract {
  row?: number;
  업체명: string;
  linkedMeetingId?: string;
}

export const COST_CHANNELS = ["매입DB", "직접생산", "현수막"] as const;
export type CostChannel = (typeof COST_CHANNELS)[number];
const isCostChannel = (key: ProfitBucket): key is CostChannel => (COST_CHANNELS as readonly string[]).includes(key);

/** 대시보드 응답(contractChannels) → 계약 행의 버킷. 키가 없으면 pending(엉뚱한 버킷에 넣지 않는다). */
export function channelBucketOf(list: readonly DashboardContractChannel[]): (row: ChannelProfitRow) => ProfitBucket {
  const byKey = new Map<string, Channel | null>(list.map((c) => [c.key, c.channel]));
  return (row) => {
    const key = contractChannelKey(row);
    if (!byKey.has(key)) return "pending";
    const channel = byKey.get(key);
    if (channel) return channel;
    return isManualContractLink(row.linkedMeetingId) ? "manual" : "unknown";
  };
}

/** 응답에 없는 계약 키(정렬·중복 제거) — 기간과 상관없이 전체 행으로 본다(다시 불러오기 판단용). */
export function missingChannelKeys(rows: readonly ChannelProfitRow[], list: readonly DashboardContractChannel[]): string[] {
  const known = new Set(list.map((c) => c.key));
  return [...new Set(rows.map((r) => contractChannelKey(r)))].filter((k) => !known.has(k)).sort();
}

export function periodChannelProfit<R extends ChannelProfitRow>(
  rows: readonly R[],
  bucketOf: (row: R) => ProfitBucket,
  overview: DbCostOverview | undefined,
  range: DateRange,
): ChannelProfitTable {
  const revenue = periodRevenueByBucket(rows, bucketOf, range);
  const cost = periodDbCostByChannel(overview, range);
  const make = (key: ProfitBucket): ChannelProfit => {
    const r = revenue.get(key);
    const c = isCostChannel(key) ? cost[key] : 0;
    const rev = r?.revenue ?? 0;
    return { key, contracts: r?.contracts ?? 0, revenue: rev, cost: c, left: rev - c };
  };
  return {
    channels: CHANNEL_ORDER.map(make),
    manual: make("manual"),
    unknown: make("unknown"),
    pending: make("pending"),
  };
}

/** 보조 줄(영업기록 없음·채널 모름·확인 중)은 이 기간에 매출이 있거나 계약이 있을 때만 보인다. */
export const hasActivity = (b: ChannelProfit): boolean => b.revenue !== 0 || b.contracts > 0;

export type ChannelHeadline =
  | { kind: "best"; channel: CostChannel; ratio: number }
  | { kind: "no-profit" }
  | { kind: "no-spend" }
  | { kind: "empty" };

/**
 * 표 위 한 줄의 근거. 「빈 기간」은 매출·DB 비용·추가 비용이 모두 0 일 때만 — 추가 비용을 못 읽었으면
 * (null) 빈 기간이라고 말하지 않는다. 돈 쓴 채널(비용 > 0) 중 매출÷비용이 가장 큰 채널(같으면 남은 돈,
 * 그다음 채널 순서)이 흑자면 best, 아니면 no-profit, 돈 쓴 채널이 없으면 no-spend.
 */
export function channelProfitHeadline(
  table: ChannelProfitTable,
  totals: { revenue: number; dbCost: number; additional: number | null },
): ChannelHeadline {
  if (totals.revenue === 0 && totals.dbCost === 0 && totals.additional === 0) return { kind: "empty" };
  let best: (ChannelProfit & { key: CostChannel }) | null = null;
  for (const c of table.channels) {
    if (!isCostChannel(c.key) || c.cost <= 0) continue;
    const cur = c as ChannelProfit & { key: CostChannel };
    if (!best) { best = cur; continue; }
    const ratio = cur.revenue / cur.cost;
    const bestRatio = best.revenue / best.cost;
    if (ratio > bestRatio || (ratio === bestRatio && cur.left > best.left)) best = cur;
  }
  if (!best) return { kind: "no-spend" };
  return best.revenue > best.cost ? { kind: "best", channel: best.key, ratio: best.revenue / best.cost } : { kind: "no-profit" };
}

/** 문장 — 채널 이름 뒤에 「에」만 붙여 받침 표가 필요 없다. */
export function channelHeadlineText(h: ChannelHeadline): string {
  switch (h.kind) {
    case "best":
      return `${h.channel}에 쓴 돈의 ${h.ratio.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}배를 벌었어요`;
    case "no-profit":
      return "아직 쓴 돈보다 더 번 채널이 없어요";
    case "no-spend":
      return "이 기간엔 DB에 쓴 돈이 없어요";
    case "empty":
      return "이 기간에는 매출·비용 기록이 없어요";
  }
}

/**
 * 표의 짧은 금액 — 만원으로 먼저 반올림하고, 0 이 아닐 때만 「−」를 붙인다(「−0만」 없음).
 * 1억 이상은 0.1억 단위(「1.9억」) — 320px 폭에서 숫자 세 칸이 한 줄에 들어가게.
 */
export function formatManShort(won: number): string {
  const man = Math.round(Math.abs(won) / 10_000);
  const sign = won < 0 && man !== 0 ? "−" : "";
  if (man >= 10_000) {
    const eok = Math.round(man / 1_000) / 10;
    return `${sign}${eok.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
  }
  return `${sign}${man.toLocaleString("ko-KR")}만`;
}

/** 원 단위 전체 금액(제목·화면 읽기용) — 「−₩1,234,567」. */
export function formatWonFull(won: number): string {
  return `${won < 0 ? "−" : ""}₩${formatMoney(Math.abs(won))}`;
}
