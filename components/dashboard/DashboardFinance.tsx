"use client";

/**
 * DashboardFinance — 대시보드 매출·비용·영업이익 묶음 + 기간 선택(전체·이번 달·이번 주·직접 설정).
 *
 * 2026-10-08 belie: 아레나 포함 여부(이월)와 상관없이 기간으로만 본다. 「전체」= 기록된
 * 기간 전체. 숫자는 화면에서 계산한다 — 계약(useContractPayments), DB 비용(useDBOverview),
 * 추가 비용(useExpenseLedger "all")을 `@/util/finance-period` 로 기간 합산한다.
 * 아레나 순위표 매출은 서버(scoreboard)가 따로 계산한다(ADR-0034).
 * 2026-10-19 구조 개선 ③④: 비용 원장 창도 여기서 연다 — 서버 대시보드는 원장을 계산·생성하지 않는다.
 * 2026-10-12 #7: 영업이익 상세에 「채널별 남은 돈」(ChannelProfitBreakdown) — 같은 기간·같은 행으로
 *   다시 계산만 한다(칩 전환 시 새 요청 없음). 계약별 채널은 /api/dashboard 의 contractChannels.
 */
import { useEffect, useMemo, useState } from "react";
import type { DashboardContractChannel } from "@/types";
import { useContractPayments } from "@/query/contract-payment-hooks";
import { useDBOverview } from "@/query/db-hooks";
import { useExpenseLedger } from "@/query/expense-ledger-hooks";
import {
  PERIOD_LABEL,
  customIncomplete,
  periodBounds,
  periodDbCost,
  periodLedgerCost,
  periodRevenue,
  type FinancePeriod,
} from "@/util/finance-period";
import { todayKST } from "@/util/week";
import PeriodPicker from "@/components/ui/PeriodPicker";
import FinanceSummaryBoxes from "./FinanceSummaryBoxes";
import ExpenseLedgerDialog from "./expense-ledger/ExpenseLedgerDialog";
import ChannelProfitBreakdown from "./ChannelProfitBreakdown";
import { channelBucketOf, missingChannelKeys, periodChannelProfit } from "./channel-profit";

// 같은 탭에서 화면을 다시 열어도 동일한 어긋남은 한 번만 재조회한다.
const refreshedChannelGroups = new Set<string>();

interface Props {
  /** /api/dashboard 의 계약별 채널. 없으면(배포 직후 캐시된 옛 응답) 채널 표를 그리지 않는다. */
  contractChannels?: DashboardContractChannel[];
  /** 계약 목록에 있는데 contractChannels 에 없는 행이 생기면 부른다 — 어긋난 묶음마다 최대 1번. */
  onRefreshChannels?: () => unknown;
  /** 대시보드를 다시 불러오는 중(「확인 중」 줄 문구). */
  channelsRefreshing?: boolean;
}

export default function DashboardFinance({ contractChannels, onRefreshChannels, channelsRefreshing = false }: Props) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const onOpenExpenseLedger = () => setLedgerOpen(true);
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const today = todayKST();
  const range = periodBounds(period, from, to, today);

  const contracts = useContractPayments();
  const db = useDBOverview();
  const ledger = useExpenseLedger("all", today.slice(0, 7));

  const rows = contracts.data?.rows;
  const bucketOf = useMemo(() => (contractChannels ? channelBucketOf(contractChannels) : null), [contractChannels]);
  // 방금 추가·이름 바꾼 계약은 대시보드 캐시(5분)에 아직 없다 → 「확인 중」으로 두고 한 번만 다시 불러온다.
  // 같은 어긋남으로는 다시 부르지 않는다(끝내 안 맞는 행이 있어도 새로고침이 반복되지 않게).
  const missing = useMemo(() => (rows && contractChannels ? missingChannelKeys(rows, contractChannels).join("\n") : ""), [rows, contractChannels]);
  useEffect(() => {
    if (!missing || !onRefreshChannels || refreshedChannelGroups.has(missing)) return;
    refreshedChannelGroups.add(missing);
    void onRefreshChannels();
  }, [missing, onRefreshChannels]);

  const totals = useMemo(() => {
    if (!contracts.data || !db.data) return null;
    const revenue = periodRevenue(contracts.data.rows ?? [], range);
    const dbCost = periodDbCost(db.data, range);
    const additional = ledger.data ? periodLedgerCost(ledger.data.entries, range, today) : null;
    const channels = bucketOf ? periodChannelProfit(contracts.data.rows ?? [], bucketOf, db.data, range) : null;
    return { revenue, dbCost, additional, cost: dbCost + (additional ?? 0), channels };
    // range 는 period/from/to/today 로 결정된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts.data, db.data, ledger.data, bucketOf, period, from, to, today]);

  const failed = contracts.isError || db.isError;
  const label = range ? `${PERIOD_LABEL[period]} ${range[0].slice(5).replace("-", "/")}~${range[1].slice(5).replace("-", "/")}` : PERIOD_LABEL.all;

  return (
    <section aria-label="매출·비용·영업이익" className="rounded-2xl border border-slate-200 bg-slate-100 p-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
        <strong className="mr-1 whitespace-nowrap text-sm text-slate-700">매출·비용·영업이익</strong>
        <PeriodPicker
          period={period}
          from={from}
          to={to}
          onPeriod={setPeriod}
          onFrom={setFrom}
          onTo={setTo}
          incomplete={customIncomplete(period, range)}
        />
      </div>
      {failed ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 text-xs text-slate-600">
          <span>매출·비용을 불러오지 못했어요.</span>
          <button type="button" onClick={() => { void contracts.refetch(); void db.refetch(); }} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-semibold text-blue-700">다시 시도</button>
        </div>
      ) : !totals || ledger.isLoading ? (
        <div className="rounded-xl bg-white px-3 py-3 text-xs text-slate-500">불러오는 중…</div>
      ) : (
        <FinanceSummaryBoxes
          revenue={totals.revenue.revenue}
          cost={totals.cost}
          feeIncome={totals.revenue.fee}
          commissionIncome={totals.revenue.received}
          refunded={totals.revenue.refunded}
          dbCostTotal={totals.dbCost}
          additionalCost={totals.additional}
          onOpenExpenseLedger={onOpenExpenseLedger}
          periodLabel={label}
          contractCount={totals.revenue.contracts}
          profitDetail={totals.channels ? (
            <ChannelProfitBreakdown
              table={totals.channels}
              revenue={totals.revenue.revenue}
              dbCost={totals.dbCost}
              additionalCost={totals.additional}
              onOpenExpenseLedger={onOpenExpenseLedger}
              refreshing={channelsRefreshing}
            />
          ) : undefined}
        />
      )}
      {/* 비용 원장 창 — 비용 칸과 같은 기간·같은 숫자(전에는 페이지가 값을 받아 다시 넘겼다). */}
      {totals && (
        <ExpenseLedgerDialog
          open={ledgerOpen}
          onClose={() => setLedgerOpen(false)}
          dbCostTotal={totals.dbCost}
          additionalCost={totals.additional}
          periodLabel={label}
        />
      )}
    </section>
  );
}
