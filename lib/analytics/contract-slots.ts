/**
 * 계약의 수납 칸(수납1~3) 규칙 — 정본 한 곳.
 *
 * 「이 칸에 뭐가 있나 · 몇 칸을 보여 주나 · 진행률 평균 · 합계 · 완료인가」를
 * 기관 목록·상세 카드·강조색·업무 현황·대시보드 후속 업무가 모두 여기서 묻는다.
 * (2026-10-19 구조 개선 ①: 전에는 3벌이 따로 있어 메모만 적힌 칸을 목록은 보이고
 *  상세 카드는 숨겼다.)
 */
import type { ContractPayment, PaymentSlot } from "@/types";

export type SlotNo = 1 | 2 | 3;

/** 수납 칸 세 개를 번호와 함께. */
export function slotsOf(cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">): Array<[SlotNo, PaymentSlot]> {
  return [[1, cp.수납1], [2, cp.수납2], [3, cp.수납3]];
}

/** 진행률 문자열("80%"·"0%"·"") → 숫자(%). */
export function progressPct(p: string): number {
  if (!p || p === "0%") return 0;
  return parseInt(p, 10) || 0;
}

/** 칸에 사용자가 적은 것이 있나 — 공백만 있는 글은 없음, 메모만 있어도 있음. */
export function slotHasData(slot: PaymentSlot): boolean {
  return Boolean(
    slot.진행기관.trim() || slot.진행상품.trim() || slot.메모.trim() || slot.현황.trim() ||
    (slot.진행률 && slot.진행률 !== "0%") || slot.승인금액 > 0 ||
    slot.수납액 > 0 || slot.수납일,
  );
}

/** 처음 보여 줄 칸 수 — 마지막으로 내용이 있는 칸까지(최소 1). */
export function visibleSlotCount(cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">): SlotNo {
  if (slotHasData(cp.수납3)) return 3;
  if (slotHasData(cp.수납2)) return 2;
  return 1;
}

/** 보이는 칸들의 진행률 평균(반올림, 칸이 없으면 0). */
export function averageProgress(slots: readonly PaymentSlot[]): number {
  if (!slots.length) return 0;
  return Math.round(slots.reduce((sum, slot) => sum + progressPct(slot.진행률), 0) / slots.length);
}

/** 계약 진행도(%) — 보이는 칸 진행률 평균. 정렬·표시 공용. */
export function contractProgress(cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">): number {
  return averageProgress([cp.수납1, cp.수납2, cp.수납3].slice(0, visibleSlotCount(cp)));
}

/** 세 칸의 승인금액·수납액 합계. */
export function slotTotals(cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">): { approved: number; received: number } {
  const slots = [cp.수납1, cp.수납2, cp.수납3];
  return {
    approved: slots.reduce((sum, slot) => sum + slot.승인금액, 0),
    received: slots.reduce((sum, slot) => sum + slot.수납액, 0),
  };
}

/** 완료 = 서류 체크 전부 + 보이는 칸 평균 진행률 100% 이상. */
export function isContractComplete(docsDone: number, docsTotal: number, avgPct: number): boolean {
  return docsDone === docsTotal && avgPct >= 100;
}
