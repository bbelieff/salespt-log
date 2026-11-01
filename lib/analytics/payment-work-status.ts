import { contractRef, normalizeContractRef } from "@/util/contract-ref";
import { isTerminatedContract, type ContractPayment, type PaymentSlot, type Todo } from "@/types";
import { normalizeInstitution } from "@/util/institution-match";
import { isHaltedSlot, isLongWaitSlot, isWaitingSlot, slotHasData, slotsOf, type SlotNo } from "./contract-slots";
import { todoSlotOf } from "./todo-slot";
// long-term.ts 도 이 파일의 isSlotClosed 를 쓴다(서로 참조) — 둘 다 함수 안에서만 불러 순환 문제 없음.
import { isLongTermContract } from "./long-term";

/**
 * 실무/수납 성과 요약과 대시보드 업무 현황의 동일한 계약 범위 — 숨김·해지만 뺀다.
 * 이월(아레나 시작 전) 계약도 실제로 진행 중인 일이라 포함한다(2026-10-08 belie, ADR-0034).
 */
export function activeWorkContracts(contracts: ContractPayment[]): ContractPayment[] {
  return contracts.filter((cp) => !cp.해지숨김 && !isTerminatedContract(cp));
}

/** longterm = 장기관리건(2026-10-24 belie) — 조건 대기·장기관리 진행건 + 직접 「장기관리」로 보낸 업체의 끝나지 않은 진행건. */
export type WorkStatusKey = "waiting" | "progress" | "approved" | "collection-waiting" | "collected" | "longterm";

export interface WorkStatusItem {
  key: string;
  status: WorkStatusKey;
  row: number | null;
  slot: SlotNo;
  company: string;
  product: string;
  institution: string;
}

export { isHaltedSlot, isLongWaitSlot, isShortWaitSlot, isWaitingSlot, slotHasData } from "./contract-slots";

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
  return `${normalizeContractRef(contractRef)}\u0000${normalizeInstitution(institution)}`;
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

/**
 * 이 진행건은 지금 챙길 일이 아닌가 — 수납 완료 · 중도중지 · 조건 대기·장기관리(2026-10-23 belie).
 * 오늘 챙길 일은 이런 진행건의 할 일·정체를 세지 않고, 업체 장기관리 자동 이동도 이 규칙을 쓴다.
 * 조건 대기·단기관리는 수납액이 있어도 진행 중이다(남은 조건을 기다린다).
 */
export function isSlotClosed(slot: PaymentSlot, todayISO: string): boolean {
  if (isWaitingSlot(slot)) return isLongWaitSlot(slot);
  return isHaltedSlot(slot) || classifyWorkStatus(slot, true, todayISO) === "collected";
}

/**
 * 업무 현황 칸 — 조건 대기·장기관리 진행건은 「장기관리」(수납액이 있어도 — isSlotClosed 와 같은 우선순위),
 * 업체가 장기관리(long-term.ts)면 수납완료가 아닌 진행건도 「장기관리」. 나머지는 classifyWorkStatus.
 */
export function workStatusOf(slot: PaymentSlot, hasTodo: boolean, todayISO: string, longTermCompany: boolean): WorkStatusKey {
  if (isLongWaitSlot(slot)) return "longterm";
  const status = classifyWorkStatus(slot, hasTodo, todayISO);
  return longTermCompany && status !== "collected" ? "longterm" : status;
}

/** 중도중지한 진행건은 업무 현황에 넣지 않는다 — 진행건이 전부 중도중지면 그 계약은 빠진다. */
export function buildWorkStatusItems(
  contracts: ContractPayment[],
  todos: Todo[],
  todayISO: string,
): WorkStatusItem[] {
  const out: WorkStatusItem[] = [];
  for (const cp of contracts) {
    const ref = contractRef(cp.계약일, cp.업체명);
    const populated = slotsOf(cp).filter(([, slot]) => slotHasData(slot));
    const live = populated.filter(([, slot]) => !isHaltedSlot(slot));
    if (populated.length && !live.length) continue;
    const effective = live.length ? live : ([slotsOf(cp)[0]!] as Array<[SlotNo, PaymentSlot]>);
    const longTermCompany = isLongTermContract(cp);
    for (const [slotNo, slot] of effective) {
      // 기관 이름이 어느 진행건과도 맞지 않는 옛 기록(unmatched)은 화면에 보이게만 하고 상태는 바꾸지 않는다.
      const hasTodo = todos.some((t) => {
        if (normalizeContractRef(t.contractRef) !== ref) return false;
        const linked = todoSlotOf(cp, t);
        return linked.slot === slotNo && linked.reason !== "unmatched";
      });
      out.push({
        key: `${cp.row ?? cp.업체명}-${slotNo}`,
        status: workStatusOf(slot, hasTodo, todayISO, longTermCompany),
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
