/**
 * 부가가치세 과세표준증명 파서 — 합성 OCR 텍스트만(예시상사·홍길동, 가짜 번호). 네트워크 없음.
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
  it("반기별매출 — 최신 먼저, 한 줄에 한 반기", () => {
    expect(f.반기별매출?.value).toBe(
      [
        "26년 상반기 1억",
        "25년 하반기 1.3억",
        "25년 상반기 1.2억",
        "24년 하반기 9,000만",
        "24년 상반기 8,000만",
        "23년 하반기 6,000만",
        "23년 상반기 5,000만",
        "22년 하반기 4,000만",
      ].join("\n"),
    );
    expect(f.반기별매출?.confidence).toBeGreaterThanOrEqual(0.8);
  });
  it("연도 합계를 올해 기준으로 칸에 나눈다", () => {
    expect(f.금년도매출?.value).toBe("26' 6월 100백만");
    expect(f.과년도매출?.value).toBe("25' 250백만");
    expect(f.과년도매출Y2?.value).toBe("24' 170백만");
    expect(f.과년도매출Y3?.value).toBe("23' 110백만");
    expect(f.과년도매출?.warnings).toEqual([]);
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
    expect(f27.과년도매출?.value).toBe("26' 100백만");
    expect(f27.과년도매출?.warnings.join()).toContain("6개월");
    expect(f27.과년도매출?.confidence).toBeLessThanOrEqual(0.5);
    expect(f27.과년도매출Y2?.value).toBe("25' 250백만");
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
    expect(f.반기별매출?.value).toBe("25년 하반기 1.3억\n25년 상반기 1.2억");
    expect(f.과년도매출?.value).toBe("25' 250백만");
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
    expect(f.반기별매출?.value).toBe("26년 상반기 1.2억\n25년 하반기 1.4억");
    expect(f.금년도매출?.value).toBe("26' 6월 120백만");
    expect(f.과년도매출?.value).toBe("25' 140백만");
    expect(f.과년도매출?.warnings.join()).toContain("6개월");
  });
  it("같은 기간 수정신고가 있으면 수정신고 금액", () => {
    const text = [
      "부가가치세 과세표준증명",
      "2025년 1기 확정 2025.07.25 120,000,000",
      "2025년 1기 수정 2025.09.10 125,000,000",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.반기별매출?.value).toBe("25년 상반기 1억 2,500만");
  });
  it("예정만 있으면 몇 월까지인지 표시하고 금년도 월도 그 달", () => {
    const text = ["부가가치세 과세표준증명", "2026년 1기 예정 2026.04.25 30,000,000"].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.반기별매출?.value).toBe("26년 상반기(1~3월) 3,000만");
    expect(f.금년도매출?.value).toBe("26' 3월 30백만");
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
    expect(f.반기별매출?.value).toBe("25년 하반기 1.3억\n25년 상반기 1.2억");
    expect(f.반기별매출?.confidence).toBeLessThanOrEqual(0.6);
    expect(f.반기별매출?.warnings.join()).toContain("끊어진 줄");
    expect(f.과년도매출?.confidence).toBeLessThanOrEqual(0.6);
  });
  it("O→0, l→1, 마침표 쉼표, 전각 숫자를 고친다", () => {
    const text = [
      "부가가치세과세표준증명",
      "２０２５년 제2기 확정 2026.01.25 13O.OOO.OOO",
      "2025년 제 1 기 확정 2025.07.25 l20,000,000",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.반기별매출?.value).toBe("25년 하반기 1.3억\n25년 상반기 1.2억");
  });
  it("간이과세자 연간(1~12월) 신고", () => {
    const text = [
      "부가가치세 과세표준증명",
      "(간이과세자)",
      "2025.01.01~2025.12.31 확정 2026.01.25 45,000,000",
      "2024.01.01~2024.12.31 확정 2025.01.25 0",
    ].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.반기별매출?.value).toBe("25년 연간 4,500만\n24년 연간 0원");
    expect(f.과년도매출?.value).toBe("25' 45백만");
    expect(f.과년도매출Y2?.value).toBe("24' 0백만");
  });
  it("단위: 천원 표기면 1000배", () => {
    const text = ["부가가치세 과세표준증명", "(단위 : 천원)", "2025년 1기 확정 2025.07.25 120,000"].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.반기별매출?.value).toBe("25년 상반기 1.2억");
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
    expect(f.반기별매출?.value).toBe("25년 하반기 1.3억\n25년 상반기 1.2억\n24년 하반기 9,000만");
    expect(f.면세수입금액?.value).toBe("25년 3,200만");
    expect(f.면세수입금액?.confidence).toBeGreaterThan(0.6);
  });
  it("라벨 다음 줄 금액이면 신뢰도 낮춤", () => {
    const text = ["부가가치세 과세표준증명", "2025년 면세 수입금액", "32,000,000"].join("\n");
    const f = byKey(parseVatCertificate(text, { today: TODAY }).fields);
    expect(f.면세수입금액?.value).toBe("25년 3,200만");
    expect(f.면세수입금액?.confidence).toBeLessThan(0.6);
  });
});
