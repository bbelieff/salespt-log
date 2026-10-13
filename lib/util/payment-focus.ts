export interface PaymentSlotTarget {
  row: number;
  slot: 1 | 2 | 3;
}

/** 대시보드 상태 목록에서 전달하는 진행 회차 링크만 허용한다. */
export function parsePaymentSlotTarget(search: string): PaymentSlotTarget | null {
  const params = new URLSearchParams(search);
  const row = Number(params.get("row"));
  const slot = Number(params.get("slot"));
  if (!Number.isSafeInteger(row) || row <= 0 || (slot !== 1 && slot !== 2 && slot !== 3)) return null;
  return { row, slot };
}

export interface PaymentRowTarget {
  row: number;
  /** null means company-only: the receiving page must not guess a work slot. */
  slot: 1 | 2 | 3 | null;
}

export function parsePaymentRowTarget(search: string): PaymentRowTarget | null {
  const params = new URLSearchParams(search);
  if (params.has("slot")) return parsePaymentSlotTarget(search);
  const row = Number(params.get("row"));
  return Number.isSafeInteger(row) && row > 0 ? { row, slot: null } : null;
}

/** A row-only deep link intentionally suppresses the company's representative slot. */
export function paymentFocusedSlot(target: PaymentRowTarget | null, row: number | undefined, fallback: 1 | 2 | 3 | null | undefined): 1 | 2 | 3 | null | undefined {
  return target && target.row === row ? target.slot : fallback;
}
