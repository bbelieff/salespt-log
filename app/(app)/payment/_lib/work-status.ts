import type { ContractPayment, PaymentSlot, Todo } from "@/types";

export type WorkStatusKey = "waiting" | "progress" | "approved" | "collection-waiting" | "collected";

export interface WorkStatusItem {
  key: string;
  status: WorkStatusKey;
  row: number | null;
  slot: 1 | 2 | 3;
  company: string;
  product: string;
  institution: string;
}

const slotsOf = (cp: ContractPayment): Array<[1 | 2 | 3, PaymentSlot]> => [
  [1, cp.수납1], [2, cp.수납2], [3, cp.수납3],
];

export function slotHasData(slot: PaymentSlot): boolean {
  return Boolean(
    slot.진행기관.trim() || slot.진행상품.trim() || slot.메모.trim() || slot.현황.trim() ||
    (slot.진행률 && slot.진행률 !== "0%") || slot.승인금액 > 0 ||
    slot.수납액 > 0 || slot.수납일,
  );
}

export function classifyWorkStatus(
  slot: PaymentSlot,
  hasTodo: boolean,
  todayISO: string,
): WorkStatusKey {
  if (slot.수납액 > 0) return "collected";
  if (slot.수납일 && slot.수납일 >= todayISO) return "collection-waiting";
  if (slot.승인금액 > 0) return "approved";
  const acted = Boolean(
    slot.진행상품.trim() || slot.메모.trim() || slot.현황.trim() || hasTodo ||
    (slot.진행률 && slot.진행률 !== "0%") || slot.수납일,
  );
  return acted ? "progress" : "waiting";
}

export function buildWorkStatusItems(
  contracts: ContractPayment[],
  todos: Todo[],
  todayISO: string,
): WorkStatusItem[] {
  const todoKeys = new Set(todos.map((t) => `${t.contractRef}|${t.institutionRef.trim()}`));
  const out: WorkStatusItem[] = [];
  for (const cp of contracts) {
    const contractRef = `${cp.계약일}|${cp.업체명}`;
    const populated = slotsOf(cp).filter(([, slot]) => slotHasData(slot));
    const effective = populated.length ? populated : ([slotsOf(cp)[0]!] as Array<[1 | 2 | 3, PaymentSlot]>);
    for (const [slotNo, slot] of effective) {
      const hasTodo = todoKeys.has(`${contractRef}|${slot.진행기관.trim()}`);
      out.push({
        key: `${cp.row ?? cp.업체명}-${slotNo}`,
        status: classifyWorkStatus(slot, hasTodo, todayISO),
        row: cp.row ?? null,
        slot: slotNo,
        company: cp.업체명,
        product: slot.진행상품,
        institution: slot.진행기관,
      });
    }
  }
  return out;
}
