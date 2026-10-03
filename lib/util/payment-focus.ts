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
