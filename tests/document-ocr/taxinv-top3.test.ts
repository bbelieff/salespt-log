/**
 * 간편인증 세금계산서 엑셀 → 사업계획서 팩트시트 매출처·매입처 TOP3(belie 2026-11-25). 가상 거래처·가짜 번호만.
 * 엑셀은 실제 생성기(taxInvWorkbook)로 만들어 두 기능의 모양이 어긋나면 여기서 깨지게 한다.
 */
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { taxInvWorkbook, toInvoices, type TaxInvPage } from "@/lib/service/simple-auth-taxinv";
import { top3FromTaxInvSheets, type SheetRows } from "@/lib/document-ocr/taxinv-top3";
import { applySuggestions, partnerSuggestions, resolveSuggestions } from "@/lib/document-ocr/bizplan-map";
import { emptyBizplanDraft } from "@/util/bizplan-pack";

const inv = (no: string, date: string, partner: [string, string], supply: number, items: [string, number][], rep = "") => ({
  resApprovalNo: no, resReportingDate: date, resSupplyValue: String(supply), resTaxAmt: String(supply / 10), resTotalAmount: String(supply * 1.1),
  resContractorRegNumber: partner[0], resContractorCompanyName: partner[1], resSupplierRegNumber: partner[0], resSupplierCompanyName: partner[1],
  resRepItems: rep, resTradeItemList: items.map(([n, v]) => ({ resTaxItemName: n, resSupplyValue: String(v) })),
});
const A: [string, string] = ["1018100001", "가상상사"];
const B: [string, string] = ["2028200002", "예시물산"];
const C: [string, string] = ["3038300003", "샘플기계"];
const D: [string, string] = ["4048400004", "견본산업"];
const pages: TaxInvPage[] = [
  { transe: "매출", biz: "", rows: [
    inv("S1", "20250105", A, 300_000_000, [["사료빈", 200_000_000], ["설치비", 100_000_000]]),
    inv("S2", "20250210", A, 150_000_000, [["설치비", 150_000_000]]),
    inv("S3", "20250301", B, 400_000_000, [], "센서모듈 외 2건"),
    inv("S4", "20250402", C, 50_000_000, [["부품", 50_000_000]]),
    inv("S5", "20250503", D, 10_000_000, [["소모품", 10_000_000]]),
  ] },
  { transe: "매입", biz: "", rows: [inv("P1", "20250107", B, 80_000_000, [["강판", 80_000_000]])] },
];

function sheetsOf(base64: string): Record<string, SheetRows> {
  const wb = XLSX.read(Buffer.from(base64, "base64"));
  return Object.fromEntries(["매출", "매입"].map((n) => [n, XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n]!, { header: 1, defval: "" })]));
}

describe("세금계산서 엑셀 → TOP3", () => {
  const top = top3FromTaxInvSheets(sheetsOf(taxInvWorkbook(toInvoices(pages))))!;

  it("거래처는 공급가액 큰 순 3곳, 품목은 그 거래처의 가장 큰 품목, 금액은 백만원(같은 장의 품목 줄은 한 번만 센다)", () => {
    expect(top.year).toBe("2025");
    expect(top.sales).toEqual([
      { name: "가상상사", item: "설치비", amount: "450" },
      { name: "예시물산", item: "센서모듈", amount: "400" },
      { name: "샘플기계", item: "부품", amount: "50" },
    ]);
    expect(top.purchases).toEqual([{ name: "예시물산", item: "강판", amount: "80" }]);
  });

  it("다른 엑셀(머리줄이 다름)은 null", () => {
    expect(top3FromTaxInvSheets({ 매출: [["이름", "금액"], ["x", 1]] })).toBeNull();
    expect(top3FromTaxInvSheets({})).toBeNull();
  });

  it("제안 → 빈 칸만 기본 체크 → 고른 줄이 표에 들어간다", () => {
    const draft = emptyBizplanDraft(2026);
    draft.sales[1] = { name: "직접적은곳", item: "", amount: "" };
    const { rows } = resolveSuggestions(partnerSuggestions(top, "세금계산서.xlsx"), draft);
    expect(rows.map((r) => [r.label, r.value, r.check])).toEqual([
      ["매출처 1위", "가상상사 · 설치비 · 450백만원", true],
      ["매출처 2위", "예시물산 · 센서모듈 · 400백만원", false],
      ["매출처 3위", "샘플기계 · 부품 · 50백만원", true],
      ["매입처 1위", "예시물산 · 강판 · 80백만원", true],
    ]);
    const next = applySuggestions(draft, rows.filter((r) => r.check));
    expect(next.sales.map((p) => p.name)).toEqual(["가상상사", "직접적은곳", "샘플기계"]);
    expect(next.purchases[0]).toEqual({ name: "예시물산", item: "강판", amount: "80" });
    expect(draft.sales[0]!.name).toBe("");
  });
});
