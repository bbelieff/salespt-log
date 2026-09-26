import { describe, expect, it } from "vitest";
import type { ContractPayment, PaymentSlot } from "@/types";
import { buildInstitutionWorkItems, groupInstitutionWorkItems } from "@/app/(app)/payment/_lib/institution-view";

const slot = (over: Partial<PaymentSlot> = {}): PaymentSlot => ({
  진행기관: "", 진행상품: "", 진행률: "", 현황: "", 승인금액: 0, 수납액: 0,
  수납일: "", 메모: "", ...over,
});
const contract = (row: number, company: string, slots: PaymentSlot[]): ContractPayment => ({
  row, 계약일: "2026-09-04", 업체명: company, 수임비: 0,
  공동인증서: false, 임대차계약서: false, 신분증: false, 드라이브업로드: false,
  사업계획서초안발송: false, 컨설팅5종서류발송: false, 플러그이관: false,
  수납1: slots[0] ?? slot(), 수납2: slots[1] ?? slot(), 수납3: slots[2] ?? slot(),
  로드맵메모: "", 계약비고: "", 해지일: "", 해지사유: "", 반환액: 0, 해지숨김: false,
});

describe("진행기관 보기의 계약→진행건 투영", () => {
  it("같은 업체가 두 기관에 진행하면 서로 다른 건으로 표시하고 정확한 슬롯을 보존한다", () => {
    const rows = [contract(3, "한빛태권도장", [
      slot({ 진행기관: " 소진공 ", 진행상품: "혁신성장촉진자금", 진행률: "60%" }),
      slot({ 진행기관: "신보", 진행상품: "보증상품", 진행률: "20%" }),
    ])];
    const items = buildInstitutionWorkItems(rows);
    expect(items.map(({ row, slot, institution, product }) => ({ row, slot, institution, product }))).toEqual([
      { row: 3, slot: 1, institution: "소진공", product: "혁신성장촉진자금" },
      { row: 3, slot: 2, institution: "신보", product: "보증상품" },
    ]);
    expect(items.map((item) => item.progress)).toEqual([60, 20]);
    expect(rows[0]?.수납1.진행기관).toBe(" 소진공 ");
  });

  it("진행이 없는 계약과 상품 미입력 진행도 누락하지 않고 마지막에 모은다", () => {
    const items = buildInstitutionWorkItems([
      contract(3, "미입력업체", []),
      contract(4, "상품없는업체", [slot({ 진행기관: "소진공" })]),
      contract(5, "상품있는업체", [slot({ 진행기관: "소진공", 진행상품: "혁신성장" })]),
    ]);
    const groups = groupInstitutionWorkItems(items);
    expect(groups.map((group) => [group.institution, group.count])).toEqual([["소진공", 2], ["", 1]]);
    expect(groups[0]?.items.map((item) => item.product)).toEqual(["혁신성장", ""]);
  });

  it("검색은 기관·상품·업체를 대상으로 하고 건수는 진행건 기준으로 센다", () => {
    const items = buildInstitutionWorkItems([
      contract(3, "한빛태권도장", [slot({ 진행기관: "소진공", 진행상품: "혁신성장" })]),
      contract(4, "두리상사", [slot({ 진행기관: "소진공", 진행상품: "일반형" })]),
    ]);
    expect(groupInstitutionWorkItems(items, "혁신 성장")[0]?.count).toBe(1);
    expect(groupInstitutionWorkItems(items, "한빛")[0]?.items[0]?.row).toBe(3);
    expect(groupInstitutionWorkItems(items, "소진공")[0]?.count).toBe(2);
  });
});
