/** 간편인증 세금계산서 — 주요 품목 집계(belie 2026-11-25). 가상 데이터만. */
import { describe, expect, it } from "vitest";
import { topItems, toInvoices } from "@/service/simple-auth-taxinv";

const inv = (supply: string, rep: string, items: { resTaxItemName?: string; resSupplyValue: string }[] = []) =>
  ({ resApprovalNo: `${rep}-${supply}-${items.length}`, resReportingDate: "20250101", resSupplyValue: supply, resRepItems: rep, resTradeItemList: items });

describe("주요 품목", () => {
  it("품목 줄 공급가액을 품목 이름별로 더하고, 품목 줄이 없으면 대표품목(「외 N건」 뺀 이름)에 그 장 금액을 붙인다", () => {
    const invoices = toInvoices([{ transe: "매출", biz: "", rows: [
      inv("300", "가상볼트 외 1건", [{ resTaxItemName: "가상볼트", resSupplyValue: "200" }, { resTaxItemName: " 가상  너트 ", resSupplyValue: "100" }]),
      inv("500", "가상볼트 외 2건"),
      inv("200", "", [{ resTaxItemName: "가상너트", resSupplyValue: "200" }]),
    ] }]);
    expect(topItems(invoices, "매출")).toEqual([
      { name: "가상볼트", supply: 700, share: 70 },
      { name: "가상 너트", supply: 100, share: 10 },
      { name: "가상너트", supply: 200, share: 20 },
    ].sort((a, b) => b.supply - a.supply));
    expect(topItems(invoices, "매입")).toEqual([]);
  });
});
