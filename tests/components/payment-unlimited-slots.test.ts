/** 실무진행 개수 제한 없음(2026-10-31 belie) — 진행 4번부터 추가진행. 이름은 합성. */
import { describe, expect, it } from "vitest";
import type { ContractPayment, PaymentSlot } from "@/types";
import { contractProgress, slotCount, slotOf, slotsOf, slotTotals, visibleSlotCount, withSlot, withoutSlot } from "@/lib/analytics/contract-slots";
import { periodRevenue } from "@/util/finance-period";
import { contractFromDbPayload } from "@/repo/db/read-daily";
import { userFieldsMirrorPayload } from "@/repo/db/contracts-clear";
import { todoSlotOf } from "@/lib/analytics/todo-slot";
import { activeSlotNumbers } from "@/lib/analytics/long-term";

const slot = (o: Partial<PaymentSlot> = {}): PaymentSlot => ({ 진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0, 수납일: "", 메모: "", ...o });
const cp = (o: Partial<ContractPayment> = {}): ContractPayment => ({
  row: 7, 계약일: "2026-10-01", 업체명: "샘플상회", 수임비: 1_000_000, 공동인증서: false, 임대차계약서: false, 신분증: false,
  드라이브업로드: false, 사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false,
  수납1: slot({ 진행기관: "소진공", 진행률: "100%" }), 수납2: slot(), 수납3: slot(), 로드맵메모: "", 계약비고: "",
  해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false, ...o,
});

describe("번호로 읽고 쓰기", () => {
  it("4번부터는 추가진행[번호-4]", () => {
    const c = cp({ 추가진행: [slot({ 진행기관: "신보" }), slot({ 진행기관: "중진공" })] });
    expect(slotsOf(c).map(([n, s]) => `${n}:${s.진행기관}`)).toEqual(["1:소진공", "2:", "3:", "4:신보", "5:중진공"]);
    expect(slotCount(c)).toBe(5);
    expect(slotOf(c, 5).진행기관).toBe("중진공");
    expect(slotOf(c, 9).진행기관).toBe("");
    expect(visibleSlotCount(c)).toBe(5);
  });
  it("쓰기는 그 번호까지 늘리고, 마지막을 지우면 줄어든다", () => {
    const c = withSlot(cp(), 5, slot({ 진행기관: "기보" }));
    expect(c.추가진행?.map((s) => s.진행기관)).toEqual(["", "기보"]);
    expect(withSlot(c, 2, slot({ 진행기관: "신보" })).수납2.진행기관).toBe("신보");
    expect(withoutSlot(c, 5).추가진행?.length).toBe(1);
    expect(withoutSlot(c, 3).수납3.진행기관).toBe("");
  });
  it("옛 계약(추가진행 없음)은 그대로 세 칸", () => {
    expect(slotsOf(cp()).length).toBe(3);
    expect(visibleSlotCount(cp())).toBe(1);
  });
});

describe("합계·진행률·매출에 4번부터 포함", () => {
  const c = cp({ 수납1: slot({ 진행률: "100%", 승인금액: 3_000_000, 수납액: 300_000, 수납일: "2026-10-10" }),
    추가진행: [slot({ 진행기관: "신보", 진행률: "40%", 승인금액: 5_000_000, 수납액: 500_000, 수납일: "2026-10-20" })] });
  it("승인금액·수납액 합계", () => expect(slotTotals(c)).toEqual({ approved: 8_000_000, received: 800_000 }));
  it("기간 매출(수임비 + 수납액)", () => {
    expect(periodRevenue([c], ["2026-10-01", "2026-10-31"]).received).toBe(800_000);
    expect(periodRevenue([c], ["2026-10-15", "2026-10-31"]).received).toBe(500_000);
  });
  it("진행률 평균은 보이는 진행건 전부", () => expect(contractProgress(c)).toBe(Math.round((100 + 0 + 0 + 40) / 4)));
  it("진행 중인 진행건 번호에 4번부터 포함(수납 전)", () => expect(activeSlotNumbers(cp({ 추가진행: [slot({ 진행기관: "신보", 진행률: "40%" })] }))).toContain(4));
});

describe("저장·읽기(DB)", () => {
  const extra = [slot({ 진행기관: "신보", 수납액: 100 })];
  it("저장 payload 에 추가진행이 들어간다", () => {
    expect(userFieldsMirrorPayload(cp({ 추가진행: extra })).추가진행).toEqual(extra);
  });
  it("DB payload 에서 그대로 읽힌다 · 없으면 비어 있다", () => {
    const p = { ...cp({ 추가진행: extra }) } as unknown as Record<string, unknown>;
    expect(contractFromDbPayload(p, 7)?.추가진행).toEqual(extra);
    const old = { ...cp() } as unknown as Record<string, unknown>;
    expect(contractFromDbPayload(old, 7)?.추가진행).toBeUndefined();
  });
});

describe("할 일 연결", () => {
  it("기관 이름이 4번 진행건에만 맞으면 4번", () => {
    const c = cp({ 추가진행: [slot({ 진행기관: "기보" })] });
    expect(todoSlotOf(c, { institutionRef: "기보" })).toEqual({ slot: 4, ambiguous: false });
    expect(todoSlotOf(c, { institutionRef: "기보", slot: 6 })).toEqual({ slot: 6, ambiguous: false });
  });
});
