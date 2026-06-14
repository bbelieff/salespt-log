/**
 * 계약 카드 진행도·슬롯 가시성 순수 헬퍼 (payment-sort §P8).
 * ContractRow(카드 표시)와 page.tsx(진행도 정렬)가 공유 — 중복 제거.
 */
import type { ContractPayment } from "@/types";

type Slot = ContractPayment["수납1"];

/** 진행률 문자열("80%"/"0%"/"") → 숫자(%). */
export function progressPct(p: string): number {
  if (!p || p === "0%") return 0;
  return parseInt(p, 10) || 0;
}

/** 슬롯에 의미있는 데이터가 있는지 (visiblePayments 초기값 계산용). */
export function hasSlotData(slot: Slot): boolean {
  return Boolean(
    slot.진행기관 ||
      slot.현황 ||
      slot.수납일 ||
      slot.승인금액 > 0 ||
      slot.수납액 > 0 ||
      (slot.진행률 && slot.진행률 !== "0%"),
  );
}

/** 데이터 기반 초기 보이는 슬롯 수 — 슬롯3 데이터 있으면 3, 슬롯2 있으면 2, else 1. */
export function initialVisiblePayments(cp: ContractPayment): 1 | 2 | 3 {
  if (hasSlotData(cp.수납3)) return 3;
  if (hasSlotData(cp.수납2)) return 2;
  return 1;
}

/** 계약 진행도(%) — 보이는 슬롯 진행률 평균. 정렬·표시 공용. */
export function contractProgress(cp: ContractPayment): number {
  const n = initialVisiblePayments(cp);
  const slots = [cp.수납1, cp.수납2, cp.수납3].slice(0, n);
  if (!slots.length) return 0;
  return Math.round(
    slots.reduce((s, sl) => s + progressPct(sl.진행률), 0) / slots.length,
  );
}

export type PaymentSortKey =
  | "date-asc"
  | "date-desc"
  | "progress-asc"
  | "progress-desc";

/** 계약일 파싱(ms). 빈값/파싱불가 → null(정렬 끝으로). */
function dateMs(s: string): number | null {
  const t = Date.parse(String(s ?? "").trim());
  return Number.isNaN(t) ? null : t;
}

/** visibleRows 를 sortKey 로 정렬(원본 불변, 안정정렬). 빈 계약일은 항상 끝. */
export function sortContracts(
  rows: ContractPayment[],
  key: PaymentSortKey,
): ContractPayment[] {
  const withIdx = rows.map((cp, i) => ({ cp, i }));
  withIdx.sort((a, b) => {
    let d = 0;
    if (key === "date-asc" || key === "date-desc") {
      const ma = dateMs(a.cp.계약일);
      const mb = dateMs(b.cp.계약일);
      if (ma === null && mb === null) d = 0;
      else if (ma === null) return 1; // 빈값 끝
      else if (mb === null) return -1;
      else d = key === "date-asc" ? ma - mb : mb - ma;
    } else {
      const pa = contractProgress(a.cp);
      const pb = contractProgress(b.cp);
      d = key === "progress-asc" ? pa - pb : pb - pa;
    }
    return d !== 0 ? d : a.i - b.i; // 동률 → 원래 순서(안정)
  });
  return withIdx.map((x) => x.cp);
}
