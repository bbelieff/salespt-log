/**
 * 계약의 진행건(수납1~3 + 추가진행 4번부터) 규칙 — 정본 한 곳.
 *
 * 「이 칸에 뭐가 있나 · 몇 칸을 보여 주나 · 진행률 평균 · 합계 · 완료인가」를
 * 기관 목록·상세 카드·강조색·업무 현황·대시보드 후속 업무가 모두 여기서 묻는다.
 * (2026-10-19 구조 개선 ①: 전에는 3벌이 따로 있어 메모만 적힌 칸을 목록은 보이고
 *  상세 카드는 숨겼다.)
 */
import { HALTED_PROGRESS, WAITING_PROGRESS, type ContractPayment, type PaymentSlot } from "@/types";

/** 진행건 번호(1부터). 1~3 = 시트 열이 있는 고정 칸, 4부터 = 추가진행[번호-4](2026-10-31 belie 「무제한」). */
export type SlotNo = number;
export type SlotSource = Pick<ContractPayment, "수납1" | "수납2" | "수납3"> & { 추가진행?: PaymentSlot[] };

const BLANK_SLOT: PaymentSlot = { 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" };

/** 진행건 전부를 번호와 함께 — 고정 세 칸 + 추가진행. */
export function slotsOf(cp: SlotSource): Array<[SlotNo, PaymentSlot]> {
  return [[1, cp.수납1], [2, cp.수납2], [3, cp.수납3], ...(cp.추가진행 ?? []).map((slot, i): [SlotNo, PaymentSlot] => [4 + i, slot])];
}

/** 진행건 수 — 고정 세 칸 + 추가진행. */
export function slotCount(cp: SlotSource): number {
  return 3 + (cp.추가진행?.length ?? 0);
}

/** 번호로 진행건 하나(없는 번호면 빈 칸). */
export function slotOf(cp: SlotSource, n: SlotNo): PaymentSlot {
  if (n === 1) return cp.수납1;
  if (n === 2) return cp.수납2;
  if (n === 3) return cp.수납3;
  return cp.추가진행?.[n - 4] ?? BLANK_SLOT;
}

/** 번호의 진행건을 바꾼 새 계약. 4번부터는 추가진행 길이를 그 번호까지 늘린다. */
export function withSlot<T extends SlotSource>(cp: T, n: SlotNo, slot: PaymentSlot): T {
  if (n <= 3) return { ...cp, [`수납${n}`]: slot };
  const extra = [...(cp.추가진행 ?? [])];
  while (extra.length < n - 4) extra.push(BLANK_SLOT);
  extra[n - 4] = slot;
  return { ...cp, 추가진행: extra };
}

/** 진행건 하나 지우기 — 1~3은 빈 칸으로, 4번부터는 목록에서 빼고 뒤 번호를 당긴다(마지막 진행건만 지울 수 있어 번호가 바뀌지 않는다). */
export function withoutSlot<T extends SlotSource>(cp: T, n: SlotNo): T {
  if (n <= 3) return { ...cp, [`수납${n}`]: BLANK_SLOT };
  return { ...cp, 추가진행: (cp.추가진행 ?? []).filter((_, i) => i !== n - 4) };
}

/** 진행률 문자열("80%"·"0%"·"") → 숫자(%). 「중도중지」·「조건 대기」는 0. */
export function progressPct(p: string): number {
  if (!p || p === "0%") return 0;
  return parseInt(p, 10) || 0;
}

/** 중도중지한 진행건인가 — 수납 없이 끝난 일. 오늘 챙길 일·업무 현황에서 뺀다. */
export function isHaltedSlot(slot: Pick<PaymentSlot, "진행률">): boolean {
  return slot.진행률 === HALTED_PROGRESS;
}

/** 「조건 대기」 진행건인가 — 조건이 풀리길 기다리는 중(2026-10-23 belie). */
export function isWaitingSlot(slot: Pick<PaymentSlot, "진행률">): boolean {
  return slot.진행률 === WAITING_PROGRESS;
}

/** 조건 대기 기간 — 고르지 않았으면 단기(진행 중으로 둔다 — 잊히지 않게). 조건 대기가 아니면 null. */
export function waitTermOf(slot: Pick<PaymentSlot, "진행률" | "대기기간">): "단기" | "장기" | null {
  if (!isWaitingSlot(slot)) return null;
  return slot.대기기간 === "장기" ? "장기" : "단기";
}

/** 조건 대기·장기관리 — 중도중지처럼 오늘 챙길 일에서 빠진다. */
export function isLongWaitSlot(slot: Pick<PaymentSlot, "진행률" | "대기기간">): boolean {
  return waitTermOf(slot) === "장기";
}

/** 조건 대기·단기관리 — 진행 중이지만 오늘 챙길 일에서 맨 뒤로 보낸다. */
export function isShortWaitSlot(slot: Pick<PaymentSlot, "진행률" | "대기기간">): boolean {
  return waitTermOf(slot) === "단기";
}

/** 칸에 사용자가 적은 것이 있나 — 공백만 있는 글은 없음, 메모만 있어도 있음. */
export function slotHasData(slot: PaymentSlot): boolean {
  // 빈 칸 객체({})가 그대로 와도 깨지지 않게 — 업체 장기관리 판정이 모든 계약의 세 칸을 읽는다.
  const text = (v: string | undefined) => (v ?? "").trim();
  return Boolean(
    text(slot.진행기관) || text(slot.진행상품) || text(slot.메모) || text(slot.현황) ||
    (slot.진행률 && slot.진행률 !== "0%") || slot.승인금액 > 0 ||
    slot.수납액 > 0 || slot.수납일,
  );
}

/** 처음 보여 줄 칸 수 — 마지막으로 내용이 있는 칸까지(최소 1). 추가진행은 있으면 그 번호까지. */
export function visibleSlotCount(cp: SlotSource): number {
  const extra = cp.추가진행?.length ?? 0;
  if (extra > 0) return 3 + extra;
  if (slotHasData(cp.수납3)) return 3;
  if (slotHasData(cp.수납2)) return 2;
  return 1;
}

/** 칸이 있고 전부 중도중지인가 — 화면은 퍼센트 대신 「중도중지」를 보여 준다. */
export function allHalted(slots: readonly PaymentSlot[]): boolean {
  return slots.length > 0 && slots.every(isHaltedSlot);
}

/**
 * 보이는 칸들의 진행률 평균(반올림, 칸이 없으면 0).
 * 중도중지 칸은 평균에서 뺀다(끝난 일 — 2026-10-23 belie). 전부 중도중지면 100 = 끝남.
 */
export function averageProgress(slots: readonly PaymentSlot[]): number {
  if (!slots.length) return 0;
  const live = slots.filter((slot) => !isHaltedSlot(slot));
  if (!live.length) return 100;
  return Math.round(live.reduce((sum, slot) => sum + progressPct(slot.진행률), 0) / live.length);
}

/** 계약 진행도(%) — 보이는 칸 진행률 평균. 정렬·표시 공용. */
export function contractProgress(cp: SlotSource): number {
  return averageProgress(slotsOf(cp).map(([, slot]) => slot).slice(0, visibleSlotCount(cp)));
}

/** 모든 진행건의 승인금액·수납액 합계. */
export function slotTotals(cp: SlotSource): { approved: number; received: number } {
  const slots = slotsOf(cp).map(([, slot]) => slot);
  return {
    approved: slots.reduce((sum, slot) => sum + slot.승인금액, 0),
    received: slots.reduce((sum, slot) => sum + slot.수납액, 0),
  };
}

/** 완료 = 서류 체크 전부 + 보이는 칸 평균 진행률 100% 이상. */
export function isContractComplete(docsDone: number, docsTotal: number, avgPct: number): boolean {
  return docsDone === docsTotal && avgPct >= 100;
}
