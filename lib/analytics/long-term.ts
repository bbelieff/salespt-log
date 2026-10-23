/**
 * 업체 「장기관리」 판정 — 정본 한 곳(2026-10-23 belie).
 *
 * 장기관리 = 지금 챙길 진행이 없는 업체. 실무/수납 목록은 기본으로 숨기고(「장기관리」 칩으로 본다)
 * 오늘 챙길 일에서도 뺀다. 계약·매출·성과 집계는 그대로 둔다(끝난 일도 매출이다).
 *
 * 실제 상태:
 *   ① 직접 「진행」 → 진행.
 *   ② 직접 「장기관리」 → 장기관리. 단 그때 진행 중이 아니던 진행건이 새로 진행 중이 되면 저절로 진행(belie 확정).
 *   ③ 직접 지정 없음 → 자동: 진행건이 1건 이상이고 진행 중인 것이 하나도 없으면 장기관리.
 * 「진행 중」의 뜻은 `slotKeepsCompanyActive` 하나 — 규칙을 바꿀 땐 여기만 고친다.
 */
import type { ContractPayment, PaymentSlot } from "@/types";
import { slotHasData, slotsOf, type SlotNo } from "./contract-slots";
import { isSlotClosed } from "./payment-work-status";

export type CompanyStage = "진행" | "장기관리";
type StageInput = Pick<ContractPayment, "수납1" | "수납2" | "수납3" | "관리상태" | "관리상태진행건">;

/**
 * 이 진행건이 업체를 「진행」에 붙잡아 두나 — 적힌 것이 있고, 수납완료·중도중지·조건 대기(장기관리)가 아니다.
 * 조건 대기·단기관리는 진행 중이다. (belie 확정, 2026-10-23)
 */
export function slotKeepsCompanyActive(slot: PaymentSlot): boolean {
  // 수납완료는 날짜와 무관(수납액 > 0) — 오늘 날짜 없이 판정해도 같다.
  return slotHasData(slot) && !isSlotClosed(slot, "");
}

/** 지금 진행 중인 진행건 번호. 직접 장기관리로 보낼 때 함께 저장한다. */
export function activeSlotNumbers(cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">): SlotNo[] {
  return slotsOf(cp).filter(([, slot]) => slotKeepsCompanyActive(slot)).map(([n]) => n);
}

/** 자동 판정 — 직접 지정을 보지 않는다. */
export function autoCompanyStage(cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">): CompanyStage {
  const populated = slotsOf(cp).filter(([, slot]) => slotHasData(slot));
  return populated.length > 0 && activeSlotNumbers(cp).length === 0 ? "장기관리" : "진행";
}

/** 실제 상태 — 직접 지정 우선, 직접 장기관리 뒤 새로 진행 중이 된 진행건이 있으면 진행. */
export function companyStage(cp: StageInput): CompanyStage {
  if (cp.관리상태 === "진행") return "진행";
  if (cp.관리상태 === "장기관리") {
    const before = new Set(cp.관리상태진행건 ?? []);
    return activeSlotNumbers(cp).some((n) => !before.has(n)) ? "진행" : "장기관리";
  }
  return autoCompanyStage(cp);
}

export function isLongTermContract(cp: StageInput): boolean {
  return companyStage(cp) === "장기관리";
}

/** 배너 토글이 저장할 값 — 장기관리로 보낼 땐 지금 진행 중인 진행건을 함께 적는다. */
export function stagePatch(cp: Pick<ContractPayment, "수납1" | "수납2" | "수납3">, stage: CompanyStage): Pick<ContractPayment, "관리상태" | "관리상태진행건"> {
  return stage === "장기관리" ? { 관리상태: "장기관리", 관리상태진행건: activeSlotNumbers(cp) } : { 관리상태: "진행", 관리상태진행건: [] };
}
