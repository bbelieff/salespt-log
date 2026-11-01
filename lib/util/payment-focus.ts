export interface PaymentSlotTarget {
  row: number;
  /** 진행건 번호(1부터, 4번부터는 추가진행). */
  slot: number;
}

/** 대시보드 상태 목록에서 전달하는 진행 회차 링크만 허용한다. */
export function parsePaymentSlotTarget(search: string): PaymentSlotTarget | null {
  const params = new URLSearchParams(search);
  const row = Number(params.get("row"));
  const slot = Number(params.get("slot"));
  if (!Number.isSafeInteger(row) || row <= 0 || !Number.isSafeInteger(slot) || slot < 1) return null;
  return { row, slot };
}

/**
 * 같은 화면 안 이동 알림 — 실무/수납에 있는 채로 빠른 보기 「오늘 챙길 일」을 누르면 주소만 바뀌고
 * 화면은 다시 열리지 않아(첫 진입 때만 주소를 읽음) 무반응이었다(2026-10-28). 누른 쪽이 이 이름으로
 * 목적지 주소(detail = href)를 알리면 실무/수납이 그 업체·진행건으로 간다.
 */
export const PAYMENT_FOCUS_EVENT = "payment-focus-request";

export interface PaymentRowTarget {
  row: number;
  /** null means company-only: the receiving page must not guess a work slot. */
  slot: number | null;
}

export function parsePaymentRowTarget(search: string): PaymentRowTarget | null {
  const params = new URLSearchParams(search);
  if (params.has("slot")) return parsePaymentSlotTarget(search);
  const row = Number(params.get("row"));
  return Number.isSafeInteger(row) && row > 0 ? { row, slot: null } : null;
}

/** A row-only deep link intentionally suppresses the company's representative slot. */
export function paymentFocusedSlot(target: PaymentRowTarget | null, row: number | undefined, fallback: number | null | undefined): number | null | undefined {
  return target && target.row === row ? target.slot : fallback;
}
