/**
 * Layer: service — 대시보드 03 DB관리 비용의 시작일(courseStart) 기준 이월 분할.
 * dashboard.ts 에서 분리(500줄 캡, BBE-83). splitContractRevenue(매출)와 대칭 — 단일
 * 결정점(date < courseStartISO). belie 결정 2026-08-07: "8/7이전 비용 이월시켜줘".
 *
 * expense-ledger(추가비용)는 이미 recognizedAmountForRange(...,courseStartISO,through)
 * 로 courseStart 이후만 인식해 무변경(03 DB관리 4섹션 중 매입DB/직접생산/현수막 3개만 대상 —
 * 콜·지·기·소는 비용 0 설계라 원래도 costBreakdown 밖).
 */
import type { DBPurchase, DBProduction, DBBanner } from "@/types";

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

export interface CostParts {
  season: number; // 시즌(개강일 이후) 비용 — 영업이익 계산에 쓰는 값
  carryover: number; // 이월(개강일 이전) 비용 — 표시용, 영업이익 제외
  total: number; // = season + carryover
}

/** 03 DB관리 raw row 1건의 (인식일, 금액) — splitDbCost 공용 입력. */
export interface DatedCostRow {
  date: string;
  amount: number;
}

/**
 * 시작일(courseStart) 기준 비용 2분할 — 시즌 vs 이월(비집계).
 * 날짜 비ISO/빈값은 isCarryoverContract 의 "비ISO→false" 규칙과 동일하게
 * **시즌으로 귀속**(오분류 방지 — 경계 불명일 때 안전한 기본값).
 */
export function splitDbCost(rows: DatedCostRow[], courseStartISO: string): CostParts {
  let season = 0;
  let carryover = 0;
  for (const r of rows) {
    const isCarryover =
      isISODate(r.date) && isISODate(courseStartISO) && r.date < courseStartISO;
    if (isCarryover) carryover += r.amount;
    else season += r.amount;
  }
  return { season, carryover, total: season + carryover };
}

/** DBPurchase[] → DatedCostRow[] (구매일 기준 — 매입DB). */
export function purchasesToDatedCost(rows: DBPurchase[]): DatedCostRow[] {
  return rows.map((p) => ({ date: p.구매일, amount: num(p.주문금액) }));
}

/**
 * DBProduction[] → DatedCostRow[] (직접생산).
 * ADR-0022 §3: 생산개수(영업관리 E) 집계는 종료일&완료 기준이지만, **비용(기간예산)은
 * 시작 시 반영** — 별개 기준. productionCountFor(lib/service/db.ts)의 종료일 기준을
 * 비용에 재사용하면 개강 전 시작·개강 후 완료 건이 시즌비용으로 오분류된다.
 */
export function productionsToDatedCost(rows: DBProduction[]): DatedCostRow[] {
  return rows.map((p) => ({ date: p.시작일, amount: num(p.기간예산) }));
}

/** DBBanner[] → DatedCostRow[] (날짜=주문일 기준 — 현수막). */
export function bannersToDatedCost(rows: DBBanner[]): DatedCostRow[] {
  return rows.map((b) => ({ date: b.날짜, amount: num(b.주문금액) }));
}
