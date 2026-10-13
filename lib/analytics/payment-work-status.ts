import { isTerminatedContract, type ContractPayment, type PaymentSlot, type Todo } from "@/types";
import { normalizeInstitution } from "@/util/institution-match";

/**
 * 실무/수납 성과 요약과 대시보드 업무 현황의 동일한 계약 범위 — 숨김·해지만 뺀다.
 * 이월(아레나 시작 전) 계약도 실제로 진행 중인 일이라 포함한다(2026-10-08 belie, ADR-0034).
 */
export function activeWorkContracts(contracts: ContractPayment[]): ContractPayment[] {
  return contracts.filter((cp) => !cp.해지숨김 && !isTerminatedContract(cp));
}

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

/** 계약×기관 단위 활동 날짜(빈 값 = 기록 없음). */
export interface SlotActivity {
  /** 미완료 Todo 의 가장 이른 예정일 — 다음에 할 일. */
  todo: string;
  /** History(이미 한 일)의 가장 늦은 날짜. */
  history: string;
  /** 완료한 Todo 의 가장 늦은 **예정일**. Todo 에 완료 시각 필드가 없어 실제 완료일은 알 수 없다. */
  done: string;
}

/** 슬롯의 저장된 기관명과 Todo/History 를 잇는 키 — 기관명 양끝 공백은 같은 것으로 본다. */
export function slotActivityKey(contractRef: string, institution: string): string {
  return `${contractRef}\u0000${normalizeInstitution(institution)}`;
}

/**
 * 실무/수납 목록(D-day 정렬)과 대시보드 「멈춘 업체」가 같은 기준으로 활동일을 읽게 하는 색인.
 * 예정일자가 빈 기록은 건너뛴다(빈 값이 유효한 날짜를 지우지 않게).
 */
export function buildSlotActivityIndex(todos: Todo[]): Map<string, SlotActivity> {
  const dates = new Map<string, SlotActivity>();
  for (const record of todos) {
    if (!record.예정일자.trim()) continue;
    const key = slotActivityKey(record.contractRef, record.institutionRef);
    const current = dates.get(key) ?? { todo: "", history: "", done: "" };
    if (record.기록종류 === "history") {
      if (record.예정일자 > current.history) current.history = record.예정일자;
    } else if (record.완료여부) {
      if (record.예정일자 > current.done) current.done = record.예정일자;
    } else if (!current.todo || record.예정일자 < current.todo) {
      current.todo = record.예정일자;
    }
    dates.set(key, current);
  }
  return dates;
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
