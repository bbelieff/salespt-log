"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { formatMoney } from "@/lib/format/money";
import { STATS_WEEKS } from "@/config/cohort-dates";

/**
 * FinanceSummaryBoxes — 매출/비용/영업이익 3열 1행 요약.
 *
 * SSOT: docs/design/components.md §9-2
 *
 * 변경 (2026-09-16, finance-three-columns):
 *   - 기존 매출/비용 2열 + 별도 OperatingProfitCard 큰 카드를 하나로 통합.
 *     세 컬럼이 320px 모바일에서도 데스크탑에서도 항상 한 행(grid-cols-3)에
 *     나란히 선다. 각 컬럼을 누르면 행 아래 공용 상세 패널이 열리고
 *     (한 번에 하나, 두 번째 클릭에 닫힘), 비용 상세 안의 추가 비용 행이
 *     기존 경비장부(ExpenseLedgerDialog) 진입점을 그대로 유지한다.
 *   - 모든 금액 계산·표시 계약은 기존 그대로: formatMoney 전체 금액
 *     (축약·절단 없음), 영업이익 = 매출 − 비용, 이익률 소수 1자리,
 *     시즌/이월/전체 분리, null 추가 비용은 0원으로 대신하지 않음.
 * 변경 (2026-09-16, finance-nowrap-fit):
 *   - ₩99,999,999·₩-99,999,999까지 320px에서도 한 줄(single line)에 전부
 *     보인다. `overflowWrap:anywhere`·줄바꿈·overflow:hidden·ellipsis·
 *     truncate·축약 금지. 금액은 `white-space:nowrap` + 실측 맞춤으로만
 *     축소한다(아래 useUniformSingleLineFit).
 */
interface Props {
  revenue: number;
  cost: number;
  feeIncome: number;
  commissionIncome: number;
  dbCostTotal: number;
  additionalCost: number | null;
  onOpenExpenseLedger: () => void;
  weeks?: number;
  contractCount?: number; // 계약 건수 (없으면 부연 우측 비움)
  /** 이월(아레나 비집계, 시작일 이전) 매출 — 있으면 매출 3줄 분리 표시. */
  carryoverRevenue?: number;
  /** 전체 매출 (= 아레나 + 이월). 없으면 revenue+carryover 로 계산. */
  totalRevenue?: number;
  /** 이월(시작일 이전 발생) 비용 — 있으면 비용도 3줄 분리 표시 (belie 결정 2026-08-07, BBE-83). */
  carryoverCost?: number;
  /** 전체 비용 (= 시즌 + 이월). 없으면 cost+carryoverCost 로 계산. */
  totalCost?: number;
}

/** 실측 맞춤 하한 — 그 아래로는 줄이지 않는다(가독성). */
export const FIT_AMOUNT_MIN_SCALE = 0.55;

/**
 * 한 줄 맞춤 스케일 — 순수 함수(테스트 가능).
 * 가용 폭 안에 텍스트가 들어가면 1(기본 clamp 유지), 넘치면 비율대로 축소.
 */
export function calcSingleLineScale(availableWidth: number, textWidth: number): number {
  if (!Number.isFinite(availableWidth) || !Number.isFinite(textWidth)) return 1;
  if (availableWidth <= 0 || textWidth <= 0) return 1;
  if (textWidth <= availableWidth) return 1;
  return Math.max(FIT_AMOUNT_MIN_SCALE, Math.min(1, availableWidth / textWidth));
}

/**
 * 3열 금액을 같은 폰트로 한 줄에 맞추는 내부 헬퍼.
 * 각 금액의 실제 가용 폭(컬럼 내용 폭)과 실측 텍스트 폭(Range→rect→
 * scrollWidth 순 폴백)을 재서 3열 중 가장 빡빡한 비율 하나를 전부에게
 * 적용한다. 기본 clamp는 유지하고 넘칠 때만 인라인 font-size로 축소.
 * ResizeObserver + window resize/orientation + font-load ready + 값 변경에
 * 재측정한다. SSR 안전(효과 안에서만 동작), 정리 시 관찰자·이벤트 해제.
 */
function useUniformSingleLineFit(
  containerRef: RefObject<HTMLDivElement | null>,
  amountRefs: RefObject<HTMLSpanElement | null>[],
  valueKey: string,
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      const els = amountRefs
        .map((r) => r.current)
        .filter((el): el is HTMLSpanElement => el !== null);
      if (els.length === 0) return;
      // 기본 clamp로 되돌려 참 크기를 잰다.
      for (const el of els) {
        el.style.fontSize = amountStyle.fontSize as string;
      }
      let minScale = 1;
      for (const el of els) {
        let available = 0;
        let textW = 0;
        try {
          const col = el.parentElement as HTMLElement | null;
          if (col) {
            let padL = 0;
            let padR = 0;
            let borderTotal = 2;
            try {
              const cs = window.getComputedStyle(col);
              padL = parseFloat(cs.paddingLeft) || 0;
              padR = parseFloat(cs.paddingRight) || 0;
              borderTotal = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
              if (!(borderTotal > 0)) borderTotal = 2;
            } catch {
              // getComputedStyle 실패 시 패딩 0·보더 2px로 간주
            }
            if (typeof col.clientWidth === "number" && col.clientWidth > 0) {
              available = col.clientWidth - padL - padR - 1;
            } else if (typeof col.getBoundingClientRect === "function") {
              const rectW = col.getBoundingClientRect().width ?? 0;
              if (rectW > 0) {
                available = rectW - borderTotal - padL - padR - 1;
              }
            }
          }
          // 실측 텍스트 폭 — overflow:hidden 없이도 전체 폭을 잰다.
          if (typeof document !== "undefined" && typeof document.createRange === "function") {
            try {
              const range = document.createRange();
              range.selectNodeContents(el);
              const rect =
                typeof range.getBoundingClientRect === "function"
                  ? range.getBoundingClientRect()
                  : null;
              if (rect && rect.width > 0) textW = rect.width;
              const detachable = range as Range & { detach?: () => void };
              if (typeof detachable.detach === "function") detachable.detach();
            } catch {
              // Range 실패 시 아래 폴백으로
            }
          }
          if (!(textW > 0) && typeof el.getBoundingClientRect === "function") {
            try {
              const r = el.getBoundingClientRect();
              if (r && r.width > 0) textW = r.width;
            } catch {
              // 무시하고 다음 폴백으로
            }
          }
          if (!(textW > 0)) {
            const sw = (el as HTMLElement).scrollWidth;
            if (typeof sw === "number" && sw > 0) textW = sw;
          }
        } catch {
          // 측정 실패 시 이 열은 스케일 1로 둔다
        }
        const s = calcSingleLineScale(available, textW);
        if (s < minScale) minScale = s;
      }
      if (minScale < 1) {
        for (const el of els) {
          let basePx = 0;
          try {
            basePx = parseFloat(window.getComputedStyle(el).fontSize) || 0;
          } catch {
            basePx = 0;
          }
          if (!(basePx > 0)) basePx = 16;
          el.style.fontSize = `${(basePx * minScale).toFixed(2)}px`;
        }
      }
    };

    fit();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      try {
        ro = new ResizeObserver(() => {
          fit();
        });
        const container = containerRef.current;
        if (container) ro.observe(container);
        for (const r of amountRefs) {
          const el = r.current;
          if (el) ro.observe(el);
          const col = el?.parentElement;
          if (col) ro.observe(col);
        }
      } catch {
        ro = null;
      }
    }
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown>; addEventListener?: (t: string, cb: () => void) => void; removeEventListener?: (t: string, cb: () => void) => void } }).fonts;
    fonts?.ready?.then?.(() => {
      if (disposed) return;
      fit();
    }).catch?.(() => {
      // 폰트 대기 실패해도 기존 크기로 표시(침묵 폴백)
    });
    fonts?.addEventListener?.("loadingdone", fit);

    return () => {
      disposed = true;
      try {
        ro?.disconnect();
      } catch {
        // 정리 중 실패 무시
      }
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      fonts?.removeEventListener?.("loadingdone", fit);
    };
    // valueKey가 바뀌면(금액 변경) 재측정. refs는 .current로 읽으므로 deps 불필요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);
}

const fmtMoney = formatMoney;

/** 한 번에 열리는 상세 패널 — null이면 전부 닫힘. */
type Panel = "revenue" | "cost" | "profit";

/**
 * 좁은 폭 대응: 금액은 항상 한 줄(white-space:nowrap, overflow-wrap:normal).
 * ₩99,999,999·₩-99,999,999까지 320px에서 줄바꿈·클리핑·ellipsis·축약 없이
 * 전부 보인다. 기본 글꼴·컬럼 패딩은 기존 cqi clamp를 유지하고, 넘칠 때만
 * 실측 맞춤 훅이 3열 동일 폰트로 축소한다. overflow:hidden은 쓰지 않는다.
 */
const amountStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontSize: "clamp(0.72rem, 4.4cqi, 1.25rem)",
  whiteSpace: "nowrap",
  overflowWrap: "normal",
  wordBreak: "normal",
};

const columnStyle: CSSProperties = {
  padding: "clamp(0.375rem, 2.5cqi, 0.75rem)",
};

/** 상세 이익표 숫자 셀 — 320px·8자리까지 분할 없이 한 줄. */
const profitCellStyle: CSSProperties = {
  whiteSpace: "nowrap",
  overflowWrap: "normal",
  wordBreak: "normal",
  fontSize: "11px",
};

const PROFIT_OK = "#1d4ed8"; // 0 이상 영업이익 (파랑)
const PROFIT_NEG = "#7c3aed"; // 음수 영업이익 (보라 — 비용 빨강과 혼동 금지)

export default function FinanceSummaryBoxes({
  revenue,
  cost,
  feeIncome,
  commissionIncome,
  dbCostTotal,
  additionalCost,
  onOpenExpenseLedger,
  weeks = STATS_WEEKS,
  contractCount,
  carryoverRevenue,
  totalRevenue,
  carryoverCost,
  totalCost,
}: Props) {
  const [open, setOpen] = useState<Panel | null>(null);
  const toggle = (panel: Panel) => setOpen((prev) => (prev === panel ? null : panel));

  // 기존 OperatingProfitCard 계산 그대로.
  const profit = revenue - cost;
  const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
  const carryRev = carryoverRevenue ?? 0;
  const totRev = totalRevenue ?? revenue + carryRev;
  const carryCost = carryoverCost ?? 0;
  const totCost = totalCost ?? cost + carryCost;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const revenueAmountRef = useRef<HTMLSpanElement | null>(null);
  const costAmountRef = useRef<HTMLSpanElement | null>(null);
  const profitAmountRef = useRef<HTMLSpanElement | null>(null);
  useUniformSingleLineFit(containerRef, [revenueAmountRef, costAmountRef, profitAmountRef], `${revenue}|${cost}|${profit}`);

  const columnClass = (selected: boolean, ring: string) =>
    `flex min-w-0 flex-col gap-1 rounded-xl border bg-white text-left transition focus-visible:outline-none focus-visible:ring-2 ${selected ? `border-slate-400 ${ring}` : "border-slate-200"} ${ring}`;

  return (
    <div ref={containerRef} style={{ containerType: "inline-size" }}>
      <div role="group" aria-label="매출·비용·영업이익" className="grid min-w-0 grid-cols-3 gap-2">
        {/* 매출 컬럼 */}
        <button
          type="button"
          id="fin-col-revenue"
          aria-expanded={open === "revenue"}
          aria-controls="fin-detail-panel"
          onClick={() => toggle("revenue")}
          style={columnStyle}
          className={columnClass(open === "revenue", "focus-visible:ring-slate-500")}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span aria-hidden="true" className="hidden h-4 w-4 shrink-0 items-center sm:flex justify-center rounded-full bg-gray-200 text-xs font-bold leading-none text-gray-700">
              ＋
            </span>
            <span className="min-w-0 whitespace-nowrap text-base font-extrabold text-slate-600">매출</span>
            <span aria-hidden="true" className={`ml-auto hidden shrink-0 text-xs text-slate-400 transition-transform sm:inline ${open === "revenue" ? "rotate-180" : ""}`}>⌄</span>
          </span>
          <span ref={revenueAmountRef} className="block w-full min-w-0 max-w-full font-bold tabular-nums text-slate-900" style={amountStyle}>
            ₩{fmtMoney(revenue)}
          </span>
        </button>

        {/* 비용 컬럼 */}
        <button
          type="button"
          id="fin-col-cost"
          aria-expanded={open === "cost"}
          aria-controls="fin-detail-panel"
          onClick={() => toggle("cost")}
          style={columnStyle}
          className={columnClass(open === "cost", "focus-visible:ring-red-500")}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span aria-hidden="true" className="hidden h-4 w-4 shrink-0 items-center sm:flex justify-center rounded-full bg-red-100 text-xs font-bold leading-none text-red-600">
              －
            </span>
            <span className="min-w-0 whitespace-nowrap text-base font-extrabold text-slate-600">비용</span>
            <span aria-hidden="true" className={`ml-auto hidden shrink-0 text-xs text-slate-400 transition-transform sm:inline ${open === "cost" ? "rotate-180" : ""}`}>⌄</span>
          </span>
          <span ref={costAmountRef} className="block w-full min-w-0 max-w-full font-bold tabular-nums text-red-600" style={amountStyle}>
            ₩{fmtMoney(cost)}
          </span>
        </button>

        {/* 영업이익 컬럼 — 0 이상 파랑 #1d4ed8, 음수 보라 #7c3aed (비용 빨강과 구분) */}
        <button
          type="button"
          id="fin-col-profit"
          aria-expanded={open === "profit"}
          aria-controls="fin-detail-panel"
          onClick={() => toggle("profit")}
          style={columnStyle}
          className={columnClass(open === "profit", "focus-visible:ring-blue-500")}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span aria-hidden="true" className="hidden h-4 w-4 shrink-0 items-center sm:flex justify-center rounded-full bg-blue-100 text-xs font-bold leading-none text-blue-700">
              ＝
            </span>
            <span className="min-w-0 whitespace-nowrap text-base font-extrabold text-slate-600">영업이익</span>
            <span aria-hidden="true" className={`ml-auto hidden shrink-0 text-xs text-slate-400 transition-transform sm:inline ${open === "profit" ? "rotate-180" : ""}`}>⌄</span>
          </span>
          <span
            ref={profitAmountRef}
            className="block w-full min-w-0 max-w-full font-bold tabular-nums"
            style={{ ...amountStyle, color: profit < 0 ? PROFIT_NEG : PROFIT_OK }}
            data-profit-sign={profit < 0 ? "negative" : "nonnegative"}
          >
            ₩{fmtMoney(profit)}
          </span>
        </button>
      </div>

      {/* 공용 상세 패널 — 행 아래 전체 폭, 한 번에 하나. 패널은 컬럼 버튼의
          형제이므로 중첩 버튼이 생기지 않는다. */}
      <div
        id="fin-detail-panel"
        role="region"
        aria-labelledby={open ? `fin-col-${open}` : undefined}
        hidden={open === null}
        className="mt-2 rounded-xl border border-slate-200 bg-white p-3"
      >
        {open === "revenue" && (
          <div className="space-y-1 text-xs leading-relaxed text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>
            <div className="flex items-baseline justify-between gap-2"><span>수임비</span><span className="break-all">₩{fmtMoney(feeIncome)}</span></div>
            <div className="flex items-baseline justify-between gap-2"><span>수수료</span><span className="break-all">₩{fmtMoney(commissionIncome)}</span></div>
          </div>
        )}
        {open === "cost" && (
          <div className="text-xs leading-relaxed text-slate-500">
            <div>DB 비용 합계 ₩{fmtMoney(dbCostTotal)}</div>
            <button
              type="button"
              onClick={onOpenExpenseLedger}
              aria-label="추가 비용: 비용 원장 열기"
              className="mt-0.5 flex min-h-6 w-full items-center justify-between gap-1 rounded text-left font-normal text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <span className="min-w-0">
                {additionalCost === null ? (
                  <span className="text-amber-700">추가 비용을 확인하지 못했습니다. 다시 시도해 주세요.</span>
                ) : (
                  <span className="flex flex-wrap items-baseline gap-x-1"><span>추가 비용</span><span className="break-all tabular-nums">₩{fmtMoney(additionalCost)}</span></span>
                )}
              </span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" /></svg>
            </button>
          </div>
        )}
        {open === "profit" && (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">{weeks}주 누적{typeof contractCount === "number" && ` · 계약 ${contractCount}건`}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">이익률 <b style={{ color: profit < 0 ? PROFIT_NEG : PROFIT_OK }}>{profitRate.toFixed(1)}%</b></span>
            </div>
            <div
              className="grid min-w-0 grid-cols-[2.5rem_repeat(3,minmax(0,1fr))] gap-1 border-t border-gray-100 pt-2 text-right text-xs tabular-nums"
              style={{ overflowWrap: "normal" }}
              data-testid="fin-profit-table"
            >
              <span /><span>시즌</span><span>이월</span><span>전체</span>
              <span className="text-left">매출</span><span style={profitCellStyle}>₩{fmtMoney(revenue)}</span><span style={profitCellStyle}>₩{fmtMoney(carryRev)}</span><span style={profitCellStyle}>₩{fmtMoney(totRev)}</span>
              <span className="text-left">비용</span><span style={profitCellStyle}>₩{fmtMoney(cost)}</span><span style={profitCellStyle}>₩{fmtMoney(carryCost)}</span><span style={profitCellStyle}>₩{fmtMoney(totCost)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

