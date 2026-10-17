"use client";

/**
 * PeriodPicker — 전체 · 이번 달 · 이번 주 · 직접 설정 칩 + (직접 설정 시) 시작·종료 날짜.
 * 실무/수납 성과 요약과 대시보드 매출·비용·영업이익이 같은 모양·같은 기간 정의를 쓴다
 * (기간 계산 = `@/util/finance-period` periodBounds). 상태는 부모가 소유한다.
 */
import { PERIOD_LABEL, type FinancePeriod } from "@/util/finance-period";

const ORDER: FinancePeriod[] = ["all", "month", "week", "custom"];

interface Props {
  period: FinancePeriod | "today";
  from: string;
  to: string;
  onPeriod: (p: FinancePeriod) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  /** 직접 설정인데 날짜가 덜 골라져 전체로 계산 중일 때 안내를 띄운다. */
  incomplete?: boolean;
  /** 화면별 짧은 이름. 계산/선택 항목은 그대로 유지한다. */
  labels?: Partial<Record<FinancePeriod, string>>;
  /** Separate-range callers opt out; all existing callers retain inline inputs. */
  showRangeInputs?: boolean;
}

export default function PeriodPicker({ period, from, to, onPeriod, onFrom, onTo, incomplete, labels, showRangeInputs = true }: Props) {
  return (
    <>
      {ORDER.map((p) => (
        <button
          key={p}
          data-period={p}
          type="button"
          aria-pressed={period === p}
          onClick={() => onPeriod(p)}
          className={`h-7 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold ${period === p ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"}`}
        >
          {labels?.[p] ?? PERIOD_LABEL[p]}
        </button>
      ))}
      {period === "custom" && showRangeInputs && (
        <>
          <input aria-label="조회 시작일" type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-7 rounded-md border border-slate-200 px-1.5 text-xs" />
          <span className="text-slate-300">–</span>
          <input aria-label="조회 종료일" type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-7 rounded-md border border-slate-200 px-1.5 text-xs" />
          {incomplete && <span className="whitespace-nowrap text-xs text-amber-700">시작일과 종료일을 고르면 그 기간만 계산해요</span>}
        </>
      )}
    </>
  );
}
