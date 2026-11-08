/** 간편인증 CODEF 응답 → 사업자별 요약·업체정보 후보(순수). 합성 응답만(필드 이름은 CODEF 상품 문서 출력부). */
import { describe, expect, it } from "vitest";
import { originalPdf, parseBizCert, parseFs, parseIncome, parseIns, parseLocalTax, parseTax, parseVat } from "@/service/simple-auth-parse";

const PDF = "JVBERi0xLjQK".padEnd(200, "A");
const field = (parts: ReturnType<typeof parseVat>, biz: string, key: string) => parts.get(biz)?.fields.filter((f) => f.key === key).map((f) => f.value);

describe("사업자등록증명", () => {
  it("다건이면 사업자마다 한 몫 — 상호·개업일(YY.MM.DD)·업태·종목·사업자구분", () => {
    const parts = parseBizCert([
      { resCompanyIdentityNo: "2148877123", resCompanyNm: "가상정밀", resUserNm: "김가상", resOpenDate: "20190311", resBusinessTypes: "제조업", resBusinessItems: "금속가공|도장", resBusinessmanType: "개인사업자", resUserAddr: "서울특별시 가상구 가상로 1", resIssueDate: "20261108" },
      { resCompanyIdentityNo: "214-12-90311", resCompanyNm: "가상물산", resUserNm: "김가상", resOpenDate: "20210101", resBusinessmanType: "개인사업자" },
    ]);
    expect([...parts.keys()]).toEqual(["214-88-77123", "214-12-90311"]);
    const a = parts.get("214-88-77123")!;
    expect(a.facts[0]).toBe("개업일 2019-03-11 · 개인사업자");
    expect(Object.fromEntries(a.fields.map((f) => [f.key, f.value]))).toMatchObject({ 개업일: "19.03.11", 업태: "제조업", 업종주생산품목: "금속가공, 도장", 사업자구분: "개인", 사업자등록번호: "214-88-77123" });
    expect(a.issuedAt).toBe("2026-11-08");
  });
  it("법인이면 법인등록번호, 주민번호 꼴이면 넣지 않는다", () => {
    const corp = parseBizCert({ resCompanyIdentityNo: "1123456789", resCompanyNm: "(주)가상", resBusinessmanType: "법인사업자", resUserIdentiyNo: "1101111234567" });
    expect(field(corp, "112-34-56789", "법인등록번호")).toEqual(["110111-1234567"]);
    const person = parseBizCert({ resCompanyIdentityNo: "1123456789", resUserIdentiyNo: "9001011******" });
    expect(field(person, "112-34-56789", "법인등록번호")).toEqual([]);
  });
});

describe("부가세 과세표준증명", () => {
  it("과세기간 합을 연도별 매출 칸(기준 연도 − 연도)으로, 원 금액도 함께", () => {
    const parts = parseVat([
      { resCompanyIdentityNo: "2148877123", commStartDate: "20250101", resIncomeTotalAmt: "600,000,000" },
      { resCompanyIdentityNo: "2148877123", commStartDate: "20250701", resIncomeTotalAmt: "684500000" },
      { resCompanyIdentityNo: "2148877123", commStartDate: "20240101", resIncomeTotalAmt: "1012300000" },
    ], 2026);
    const p = parts.get("214-88-77123")!;
    expect(p.facts[0]).toBe("2025년 1,284,500,000원 · 2024년 1,012,300,000원");
    expect(p.fields.find((f) => f.key === "과년도매출")).toMatchObject({ value: "1,284.5", sourceWon: 1284500000 });
    expect(field(parts, "214-88-77123", "과년도매출Y2")).toEqual(["1,012.3"]);
  });
});

describe("표준재무제표증명", () => {
  it("해마다 매출을 매출 칸에, 가장 최근 해의 손익·재무를 재무 칸에(손실 과목은 음수)", () => {
    const year = (y: string, sales: string, op: { t: string; v: string }) => ({
      resCompanyIdentityNo: "2148877123", resAttrYear: y,
      resIncomeStatement: [{ _title: "Ⅰ.매출액", _amt: sales }, { _title: op.t, _amt: op.v }, { _title: "이자비용", _amt: "1000000" }],
      resBalanceSheet: [{ _title: "자산총계", _amt: "2050000000" }],
    });
    const parts = parseFs([year("2025", "1301000000", { t: "Ⅴ.영업손실", v: "5000000" }), year("2024", "1020000000", { t: "영업이익", v: "80000000" })], 2026);
    const p = parts.get("214-88-77123")!;
    expect(p.facts).toEqual(["2025년 매출액 1,301,000,000원 · 영업이익 -5,000,000원", "2024년 매출액 1,020,000,000원 · 영업이익 80,000,000원"]);
    expect(Object.fromEntries(p.fields.map((f) => [f.key, f.value]))).toMatchObject({ 과년도매출: "1,301", 과년도매출Y2: "1,020", 결산연도: "2025", 영업이익: "-5", 이자비용: "1", 자산총계: "2,050" });
  });
});

describe("납세증명·4대보험·소득금액", () => {
  it("국세: 납세상태·유효기간, 체납이 있으면 건수", () => {
    const p = parseTax({ resCompanyIdentityNo: "2148877123", resPaymentTaxStatus: "해당없음", resValidPeriod: "20261208", resArrearsList: [{ resTaxItemName: "부가가치세" }], resRespiteList: [{ resTaxItemName: "" }] });
    expect(p.get("214-88-77123")!.facts).toEqual(["납세상태 해당없음 · 유효기간 2026-12-08까지", "체납 1건"]);
  });
  it("지방세: 발급되면 체납 없음", () => {
    const p = parseLocalTax({ resCompanyIdentityNo: "", resIssueOgzNm: "가상시 가상구청장", resValidPeriod: "20261208", resRespiteList: [] });
    expect(p.get("")!.facts).toEqual(["발급 가상시 가상구청장 · 유효기간 2026-12-08까지 · 체납 없음"]);
  });
  it("4대보험: 가입자 수만 — 성명·주민번호는 결과에 남지 않는다", () => {
    const p = parseIns({ resBasicList: [{ resCompanyIdentityNo: "2148877123", resCompanyNm: "가상정밀" }], resJoinList: [{ resUserNm: "가상일", resUserIdentityNo: "900101-1******" }, { resUserNm: "가상이" }] });
    const part = p.get("214-88-77123")!;
    expect(part.facts).toEqual(["가입자 2명"]);
    expect(JSON.stringify(part)).not.toMatch(/가상일|900101/);
    expect(part.fields).toEqual([{ key: "사대보험직원", value: "2명", confidence: 0.9 }]);
  });
  it("소득금액증명: 사업자에 묶이지 않는 몫(\"\")", () => {
    const p = parseIncome({ resGeneralIncomeTaxList: [{ resAttrYear: "2025", resIncomeAmt: "84200000" }] });
    expect(p.get("")!.facts).toEqual(["2025년 소득 84,200,000원"]);
  });
});

describe("원문 PDF 필드", () => {
  it("문서마다 다른 대소문자(resOriGinalData1 · resOriginalData1 · reqOriginalData1)를 모두 읽는다", () => {
    expect(originalPdf({ resOriGinalData1: PDF })).toBe(PDF);
    expect(originalPdf({ resOriginalData1: PDF })).toBe(PDF);
    expect(originalPdf({ reqOriginalData1: PDF })).toBe(PDF);
    expect(originalPdf({ resOriGinalData: PDF })).toBe("");
    expect(originalPdf({ resOriGinalData: PDF }, "resOriGinalData")).toBe(PDF);
  });
});
