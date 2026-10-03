/**
 * 부가가치세 과세표준증명 파서 — 합성 OCR 텍스트만(예시상사·홍길동, 가짜 번호). 네트워크 없음.
 * 금액은 백만원 정본("120" · "250.1") + 원문 원 금액(sourceWon) — company-finance-won-grid 2026-09-28.
 * 칸 = 매출 기준 연도(baseYear, 없으면 today 연도) − 문서 연도.
 */
import { describe, expect, it } from "vitest";
import {
  parseAmountToken,
  parseVatCertificate,
} from "@/lib/document-ocr/parse-vat";
import type { ParsedField } from "@/lib/document-ocr/types";

const TODAY = new Date(2026, 8, 28); // 2026-09-28
const byKey = (fields: ParsedField[]) => Object.fromEntries(fields.map((f) => [f.key, f]));

const HEADER = [
  "부 가 가 치 세  과 세 표 준 증 명",
  "발급번호 1234-567-8901",
  "상호(법인명) 예시상사   사업자등록번호 123-45-67891",
  "성명(대표자) 홍길동   주민(법인)등록번호 800101-1234567",
  "증명기간 2023.01.01 ~ 2026.06.30",
  "과세기간  신고구분  신고일  과세표준  납부할세액",
];

/** 개인 일반과세자 — 반기 확정만, 최신 먼저. */
const PERSONAL = [
  ...HEADER,
  "2026년 1기  정기(확정)  2026-07-24  100,000,000  9,000,000",
  "2025년 2기  정기(확정)  2026-01-25  130,000,000  12,000,000",
  "2025년 1기  정기(확정)  2025-07-25  120,000,000  11,000,000",
  "2024년 2기  확정  2025-01-24  90,000,000  8,000,000",
  "2024년 1기  확정  2024-07-25  80,000,000  7,000,000",
  "2023년 2기  확정  2024-01-25  60,000,000  5,000,000",
  "2023년 1기  확정  2023-07-25  50,000,000  4,000,000",
  "2022년 2기  확정  2023-01-25  40,000,000  3,000,000",
].join("\n");

describe("금액 표기 헬퍼", () => {
  it("parseAmountToken", () => {
    expect(parseAmountToken("125,000,000")).toBe(125_000_000);
    expect(parseAmountToken("125.000.000")).toBe(125_000_000);
    expect(parseAmountToken("12a")).toBeNull();
  });
});

describe("parseVatCertificate — 개인 반기 확정", () => {
  const r = parseVatCertificate(PERSONAL, { today: TODAY });
  const f = byKey(r.fields);
  it("반기 매출 8칸 — 올해(Y)~3년 전(Y-3) 상·하반기에 백만원 값 + 원문 원", () => {
    expect(f.매출Y상?.value).toBe("100");
    expect(f.매출Y하).toBeUndefined(); // 26년 2기 신고 없음
    expect(f.매출Y1상?.value).toBe("120");
    expect(f.매출Y1상?.sourceWon).toBe(120_000_000);
    expect(f.매출Y1하?.value).toBe("130");
    expect(f.매출Y2상?.value).toBe("80");
    expect(f.매출Y2하?.value).toBe("90");
    expect(f.매출Y3상?.value).toBe("50");
    expect(f.매출Y3하?.value).toBe("60");
    expect(f.매출Y1상?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(f.매출Y1상?.warnings).toEqual([]);
  });
  it("옛 한 칸 반기별매출은 더 채우지 않고, 칸 밖(22년)은 넣지 않고 알린다", () => {
    expect(f.반기별매출).toBeUndefined();
    expect(r.fields.some((x) => x.value === "40")).toBe(false);
    expect(r.documentWarnings).toContain("2022년 금액은 매출 칸(2023~2026년) 밖이라 넣지 않았어요.");
  });
  it("연도 합계를 기준 연도(= 올해) 칸에 나눈다", () => {
    expect(f.금년도매출?.value).toBe("100");
    expect(f.금년도매출?.warnings).toEqual(["26년은 6월까지 신고 금액이에요."]);
    expect(f.과년도매출?.value).toBe("250");
    expect(f.과년도매출?.sourceWon).toBe(250_000_000);
    expect(f.과년도매출Y2?.value).toBe("170");
    expect(f.과년도매출Y3?.value).toBe("110");
    expect(f.과년도매출?.warnings).toEqual([]);
  });
  it("기준 연도를 주면 문서 연도를 그 기준 칸에 놓는다(slot = 기준 − 문서 연도)", () => {
    const r25 = parseVatCertificate(PERSONAL, { today: TODAY, baseYear: 2025 });
    const g = byKey(r25.fields);
    expect(g.금년도매출?.value).toBe("250"); // 2025 = Y
    expect(g.매출Y상?.value).toBe("120");
    expect(g.과년도매출Y3?.value).toBe("40"); // 2022 = Y-3 (하반기만 → 일부 경고)
    expect(g.과년도매출Y3?.warnings.join()).toContain("6개월");
    expect(r25.documentWarnings.join()).toContain("2026년 금액은 매출 칸(2022~2025년) 밖");
  });
  it("증명기간·신고일·사업자번호·납부세액을 금액으로 착각하지 않는다", () => {
    expect(r.fields.every((x) => !x.value.includes("1234"))).toBe(true);
  });
  it("주민등록번호 뒷자리는 어디에도 없다", () => {
    const all = JSON.stringify(r);
    expect(all).not.toContain("1234567");
    expect(r.documentWarnings).toContain("주민등록번호는 읽지 않았어요.");
  });
  it("today 를 바꾸면 칸이 따라 움직인다", () => {
    const f27 = byKey(parseVatCertificate(PERSONAL, { today: new Date(2027, 1, 1) }).fields);
    expect(f27.금년도매출).toBeUndefined();
    expect(f27.매출Y상).toBeUndefined();
    expect(f27.매출Y1상?.value).toBe("100"); // 26년 상반기 → 이제 Y-1
    expect(f27.매출Y3하?.value).toBe("90"); // 24년 하반기 → 이제 Y-3
    expect(Object.values(f27).some((x) => x.value === "60")).toBe(false); // 23년 = Y-4, 칸 밖
    expect(f27.과년도매출?.value).toBe("100");
    expect(f27.과년도매출?.warnings.join()).toContain("6개월");
    expect(f27.과년도매출?.confidence).toBeLessThanOrEqual(0.5);
    expect(f27.과년도매출Y2?.value).toBe("250");
  });
});

describe("예정·확정 겹침", () => {
  it("개인: 예정(1~3월)과 확정(1~6월)이 같이 있으면 확정만 — 이중 합산 금지", () => {
    const text = [
      "부가가치세 과세표준증명",
      "2025년 2기 확정 2026.01.25 130,000,000 12,000,000",
      "2025년 2기 예정 2025.10.25 60,000,000 5,000,000",
      "2025년 1기 확정 2025.07.25 120,000,000 11,000,000",
      "2025년 1기 예정 2025.04.25 55,000,000 5,000,000",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y1하?.value).toBe("130");
    expect(f.매출Y1상?.value).toBe("120");
    expect(f.과년도매출?.value).toBe("250");
  });
  it("법인: 기간이 안 겹치면(예정 1~3월 + 확정 4~6월) 더한다", () => {
    const text = [
      "부가가치세 과세표준증명",
      "과세기간 신고구분 신고일 과세표준",
      "2026.04.01 ~ 2026.06.30 정기(확정) 2026.07.25 70,000,000 6,000,000",
      "2026.01.01 ~ 2026.03.31 예정 2026.04.25 50,000,000 4,000,000",
      "2025.10.01 ~ 2025.12.31 정기(확정) 2026.01.25 80,000,000 7,000,000",
      "2025.07.01 ~ 2025.09.30 예정 2025.10.25 60,000,000 5,000,000",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y상?.value).toBe("120");
    expect(f.매출Y상?.warnings).toEqual([]); // 1~3월+4~6월 = 반기 전체
    expect(f.매출Y1하?.value).toBe("140");
    expect(f.금년도매출?.value).toBe("120");
    expect(f.과년도매출?.value).toBe("140");
    expect(f.과년도매출?.warnings.join()).toContain("6개월");
  });
  it("같은 기간 수정신고가 있으면 수정신고 금액", () => {
    const text = [
      "부가가치세 과세표준증명",
      "2025년 1기 확정 2025.07.25 120,000,000",
      "2025년 1기 수정 2025.09.10 125,000,000",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y1상?.value).toBe("125");
  });
  it("예정만 있으면 반기 칸은 값만 두고 몇 월 신고인지 경고, 금년도 월도 그 달", () => {
    const text = ["부가가치세 과세표준증명", "2026년 1기 예정 2026.04.25 30,000,000"].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y상?.value).toBe("30");
    expect(f.매출Y상?.warnings.join()).toContain("상반기(1~3월)");
    expect(f.매출Y상?.confidence).toBeLessThanOrEqual(0.6);
    expect(f.금년도매출?.value).toBe("30");
    expect(f.금년도매출?.warnings.join()).toContain("3월까지");
  });
});

describe("OCR 노이즈", () => {
  it("끊어진 줄에서 금액을 이어 읽으면 신뢰도를 낮추고 경고", () => {
    const text = [
      "부 가 가 치 세 과 세 표 준 증 명",
      "2025년 2기 정기(확정)",
      "2026-01-25",
      "130,000,000 12,000,000",
      "2025년 1기 정기(확정) 2025-07-25 120,000,000",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y1하?.value).toBe("130");
    expect(f.매출Y1하?.confidence).toBeLessThanOrEqual(0.6);
    expect(f.매출Y1하?.warnings.join()).toContain("끊어진 줄");
    expect(f.매출Y1상?.value).toBe("120");
    expect(f.과년도매출?.confidence).toBeLessThanOrEqual(0.6);
  });
  it("O→0, l→1, 마침표 쉼표, 전각 숫자를 고친다", () => {
    const text = [
      "부가가치세과세표준증명",
      "２０２５년 제2기 확정 2026.01.25 13O.OOO.OOO",
      "2025년 제 1 기 확정 2025.07.25 l20,000,000",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y1하?.value).toBe("130");
    expect(f.매출Y1상?.value).toBe("120");
  });
  it("간이과세자 연간(1~12월) 신고 — 반기 칸 없이 연도 합계만", () => {
    const text = [
      "부가가치세 과세표준증명",
      "(간이과세자)",
      "2025.01.01~2025.12.31 확정 2026.01.25 45,000,000",
      "2024.01.01~2024.12.31 확정 2025.01.25 0",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(Object.keys(f).filter((k) => k.startsWith("매출Y"))).toEqual([]);
    expect(f.과년도매출?.value).toBe("45");
    expect(f.과년도매출Y2?.value).toBe("0");
  });
  it("단위: 천원 표기면 1000배 — 원으로 바꾼 뒤 백만원(소수 둘째 자리 반올림)", () => {
    const text = ["부가가치세 과세표준증명", "(단위 : 천원)", "2025년 1기 확정 2025.07.25 120,050"].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y1상?.value).toBe("120.1");
    expect(f.매출Y1상?.sourceWon).toBe(120_050_000);
  });
  it("원 단위 금액은 백만원 소수 한 자리로(250,123,456원 → 250.1)", () => {
    const text = ["부가가치세 과세표준증명", "2025년 1기 확정 2025.07.25 250,123,456"].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y1상?.value).toBe("250.1");
    expect(f.매출Y1상?.sourceWon).toBe(250_123_456);
  });
  it("금액을 못 읽은 줄은 세고 넘어간다", () => {
    const r = parseVatCertificate(["부가가치세 과세표준증명", "2025년 1기 확정 흐림"].join("\n"), { today: TODAY });
    expect(r.fields).toEqual([]);
    expect(r.documentWarnings.join()).toContain("1줄은 금액을 못 읽었어요");
  });
  it("빈 텍스트", () => {
    expect(parseVatCertificate("", { today: TODAY }).documentWarnings[0]).toContain("읽힌 글자가 없어요");
  });
});

describe("면세수입금액", () => {
  it("겸영 — 과세 줄 뒤 면세 금액은 따로, 최근 연도", () => {
    const text = [
      "부가가치세 과세표준증명",
      "2025년 2기 확정 2026.01.25 130,000,000 면세수입금액 20,000,000",
      "2025년 1기 확정 2025.07.25 120,000,000 면세수입금액 12,000,000",
      "2024년 2기 확정 2025.01.25 90,000,000 면세수입금액 5,000,000",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.매출Y1하?.value).toBe("130");
    expect(f.매출Y1상?.value).toBe("120");
    expect(f.매출Y2하?.value).toBe("90");
    expect(f.면세수입금액?.value).toBe("32");
    expect(f.면세수입금액?.sourceWon).toBe(32_000_000);
    expect(f.면세수입금액?.confidence).toBeGreaterThan(0.6);
    expect(parseVatCertificate(text, { today: TODAY }).info).toContainEqual({ label: "면세 수입금액 연도", value: "2025년" });
  });
  it("라벨 다음 줄 금액이면 신뢰도 낮춤", () => {
    const text = ["부가가치세 과세표준증명", "2025년 면세 수입금액", "32,000,000"].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.면세수입금액?.value).toBe("32");
    expect(f.면세수입금액?.confidence).toBeLessThan(0.6);
  });
});
