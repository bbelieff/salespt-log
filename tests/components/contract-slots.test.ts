/**
 * 구조 개선 ① — 수납 칸 규칙 한 곳. 목록·상세·강조색이 같은 답을 내는지 고정.
 * 모든 값은 합성.
 */
import { describe, expect, it } from "vitest";
import type { ContractPayment, PaymentSlot } from "@/types";
import { averageProgress, contractProgress, isContractComplete, slotHasData, slotTotals, visibleSlotCount } from "@/lib/analytics/contract-slots";
import { hasSlotData, initialVisiblePayments } from "@/app/(app)/payment/_lib/payment-progress";
import { slotHasData as workStatusSlotHasData } from "@/lib/analytics/payment-work-status";
import { contractAccentFamily } from "@/app/(app)/payment/_lib/contractAccent";

const empty: PaymentSlot = { 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "" };
const cp = (s1: Partial<PaymentSlot>, s2: Partial<PaymentSlot> = {}, s3: Partial<PaymentSlot> = {}) =>
  ({ 수납1: { ...empty, ...s1 }, 수납2: { ...empty, ...s2 }, 수납3: { ...empty, ...s3 } }) as unknown as ContractPayment;

describe("수납 칸 「입력됨」 — 세 화면이 같은 답", () => {
  it("메모만 있어도 입력됨, 공백만 있으면 아님", () => {
    expect(slotHasData({ ...empty, 메모: "서류 대기" })).toBe(true);
    expect(slotHasData({ ...empty, 진행기관: "   " })).toBe(false);
    expect(slotHasData({ ...empty, 진행률: "0%" })).toBe(false);
  });
  it("옛 이름도 같은 함수", () => {
    expect(hasSlotData).toBe(slotHasData);
    expect(workStatusSlotHasData).toBe(slotHasData);
    expect(initialVisiblePayments).toBe(visibleSlotCount);
  });
  it("메모만 있는 3번째 칸까지 보인다(전에는 상세 카드에서 숨었음)", () => {
    expect(visibleSlotCount(cp({ 진행기관: "가은행" }, {}, { 메모: "다음 달 신청" }))).toBe(3);
    expect(visibleSlotCount(cp({}, { 진행상품: "  " }))).toBe(1);
  });
});

describe("진행률·합계·완료", () => {
  it("보이는 칸 평균", () => {
    expect(contractProgress(cp({ 진행률: "100%" }, { 진행률: "60%" }))).toBe(80);
    expect(averageProgress([])).toBe(0);
  });
  it("합계", () => {
    expect(slotTotals(cp({ 승인금액: 100, 수납액: 30 }, { 승인금액: 50, 수납액: 20 }))).toEqual({ approved: 150, received: 50 });
  });
  it("완료 = 서류 전부 + 평균 100", () => {
    expect(isContractComplete(5, 5, 100)).toBe(true);
    expect(isContractComplete(4, 5, 100)).toBe(false);
    expect(isContractComplete(5, 5, 99)).toBe(false);
  });
  it("강조색: 진행 중인 마지막 칸 색", () => {
    expect(contractAccentFamily(cp({ 진행률: "40%" }, { 진행률: "20%" }))).toBe("blue");
    expect(contractAccentFamily(cp({}))).toBe("slate");
  });
});
