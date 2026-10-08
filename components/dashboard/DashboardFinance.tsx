"use client";

/**
 * DashboardFinance — 대시보드 매출·비용·영업이익 묶음 + 기간 선택(전체·이번 달·이번 주·직접 설정).
 *
 * 2026-10-08 belie: 아레나 포함 여부(이월)와 상관없이 기간으로만 본다. 「전체」= 기록된
 * 기간 전체. 숫자는 화면에서 계산한다 — 계약(useContractPayments), DB 비용(useDBOverview),
 * 추가 비용(useExpenseLedger "all")을 `@/util/finance-period` 로 기간 합산한다.
 * 아레나 순위표 매출은 서버(scoreboard)가 따로 계산한다(ADR-0034).
 */
import { useMemo, useState } from "react";
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
  todayKst,
  type FinancePeriod,
} from "@/util/finance-period";
import PeriodPicker from "@/components/ui/PeriodPicker";
import FinanceSummaryBoxes from "./FinanceSummaryBoxes";

export default function DashboardFinance({ onOpenExpenseLedger }: { onOpenExpenseLedger: () => void }) {
  const [period, setPeriod] = useState<FinancePeriod>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const today = todayKst();
  const range = periodBounds(period, from, to, today);

  const contracts = useContractPayments();
  const db = useDBOverview();
  const ledger = useExpenseLedger("all", today.slice(0, 7));

  const totals = useMemo(() => {
    if (!contracts.data || !db.data) return null;
    const revenue = periodRevenue(contracts.data.rows ?? [], range);
    const dbCost = periodDbCost(db.data, range);
    const additional = ledger.data ? periodLedgerCost(ledger.data.entries, range, today) : null;
    return { revenue, dbCost, additional, cost: dbCost + (additional ?? 0) };
    // range 는 period/from/to/today 로 결정된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts.data, db.data, ledger.data, period, from, to, today]);

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
        />
      )}
    </section>
  );
}
