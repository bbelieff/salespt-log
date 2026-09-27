/**
 * 문서로 자동입력 — 임대차계약서 파서. 합성 OCR 텍스트만(예시상사·홍길동, 가짜 번호).
 */
import { describe, expect, it } from "vitest";
import {
  detectVat,
  findAmounts,
  findAreas,
  formatArea,
  parseKoreanAmount,
  parseLeaseContract,
} from "@/lib/document-ocr/parse-lease";
import type { ParsedField } from "@/lib/document-ocr/types";

const byKey = (fields: ParsedField[]) => Object.fromEntries(fields.map((f) => [f.key, f]));

/** 표준 양식 흉내 — 자간 노이즈·한글+숫자 병기·주민등록번호(가짜) 포함. */
const STANDARD_LEASE = [
  "부 동 산 임 대 차 계 약 서",
  "□전세 ■월세",
  "임대인과 임차인 쌍방은 아래 표시 부동산에 관하여 다음 계약 내용과 같이 임대차계약을 체결한다.",
  "1. 부동산의 표시",
  "소 재 지  서울특별시 중구 예시로 1, 예시빌딩",
  "토 지  지목 대  면적 330 ㎡",
  "건 물  구조·용도 철근콘크리트 / 근린생활시설  면적 500 ㎡",
  "임대할부분  1층 101호  면적 33 ㎡",
  "2. 계약내용",
  "제1조 (목적) 위 부동산의 임대차에 한하여 임대인과 임차인은 합의에 의하여 보증금 및 차임을 아래와 같이 지불하기로 한다.",
  "보 증 금  금 일천만원정 ( ₩10,000,000 )",
  "계 약 금  금 일백만원정은 계약시에 지불하고 영수함. 영수자 (홍길동 인)",
  "잔 금  금 구백만원정은 2026 년 10 월 1 일에 지불한다.",
  "차 임  금 오십만원정은 (선불로) 매월 25일에 지불한다. (부가세 □불포함 ■포함)",
  "제2조 (존속기간) 임대인은 위 부동산을 2026 년 10 월 1 일까지 임차인에게 인도하며, 임대차 기간은 인도일로부터 24개월로 한다.",
  "임대인 주소 서울특별시 중구 예시로 2 주민등록번호 800101-1234567 성명 홍길동",
  "임차인 주소 서울특별시 중구 예시로 3 주민등록번호 800101-2234567 성명 김예시",
].join("\n");

/** 상가 계약서 흉내 — 숫자 금액·평 표기·부가세 별도. */
const SHOP_LEASE = [
  "상가건물 임대차 계약서",
  "소재지: 경기도 평택시 예시로 12 (예시동)  ",
  "임대부분: 2층 전부 20평",
  "보증금: 金 30,000,000원",
  "월세: 1,500,000원 (VAT 별도)",
  "관리비: 금 100,000원",
].join("\n");

describe("parseKoreanAmount", () => {
  it.each([
    ["금 일천만원정", 10_000_000],
    ["金 10,000,000원", 10_000_000],
    ["₩10,000,000", 10_000_000],
    ["오십만원", 500_000],
    ["1억 2천만원", 120_000_000],
    ["일억이천오백만원정", 125_000_000],
    ["5,000만원", 50_000_000],
    ["1.5억", 150_000_000],
    ["10.000.000원", 10_000_000],
    ["壹仟萬원", 10_000_000],
    ["삼백오십만", 3_500_000],
    ["500,000 이하", 500_000],
  ])("%s", (raw, want) => {
    expect(parseKoreanAmount(raw)).toBe(want);
  });
  it("숫자가 없으면 null", () => {
    expect(parseKoreanAmount("만료")).toBeNull();
    expect(parseKoreanAmount("")).toBeNull();
  });
});

describe("findAmounts", () => {
  it("날짜·호수·개월은 금액이 아니다", () => {
    expect(findAmounts("매월 25일에 지불 101호 24개월")).toEqual([]);
  });
  it("한글·숫자 병기는 두 후보(같은 값)", () => {
    expect(findAmounts(" 금 일천만원정 ( ₩10,000,000 )").map((c) => c.won)).toEqual([10_000_000, 10_000_000]);
  });
});

describe("면적", () => {
  it("한쪽만 있으면 환산", () => {
    expect(formatArea(33, null)).toBe("33㎡(10평)");
    expect(formatArea(null, 20)).toBe("66.12㎡(20평)");
    expect(formatArea(33.06, 10)).toBe("33.06㎡(10평)");
  });
  it("㎡·평 병기는 한 면적, '평택' 은 면적이 아니다", () => {
    expect(findAreas("면적 33.06㎡(10평)")).toEqual([{ sqm: 33.06, pyeong: 10 }]);
    expect(findAreas("123 평택로")).toEqual([]);
    expect(findAreas("33 m2")).toEqual([{ sqm: 33, pyeong: null }]);
  });
});

describe("detectVat", () => {
  it.each([
    ["(부가세 □불포함 ■포함)", "none"],
    ["(부가세 ■불포함 □포함)", "separate"],
    ["(부가세 □불포함 □포함)", "ambiguous"],
    ["월세 150만원 (VAT 별도)", "separate"],
    ["부가가치세 별도", "separate"],
    ["차임 금 오십만원", "none"],
  ])("%s", (text, want) => {
    expect(detectVat(text)).toBe(want);
  });
});

describe("parseLeaseContract — 표준 양식", () => {
  const r = parseLeaseContract(STANDARD_LEASE);
  const f = byKey(r.fields);
  it("업체정보 키·형식으로 낸다", () => {
    expect(f.소재지?.value).toBe("서울특별시 중구 예시로 1, 예시빌딩");
    expect(f.임차보증금?.value).toBe("1,000만");
    expect(f.임차보증금?.confidence).toBeGreaterThanOrEqual(0.9); // 한글·숫자 일치
    expect(f.임차월세?.value).toBe("50만");
    expect(f.임차월세?.warnings).toEqual([]); // 부가세 포함에 체크
    expect(f.임차면적?.value).toBe("33㎡(10평)"); // 토지·건물 면적이 아니라 임대할 부분
    expect(f.소유여부?.value).toBe("임차 : 보 1000만, 월 50만");
  });
  it("계약기간·임대인·용도는 읽지 않고, 주민등록번호 뒷자리는 어디에도 없다", () => {
    const keys = r.fields.map((x) => x.key);
    expect(keys).not.toContain("대표자이름");
    expect(keys).not.toContain("주민등록번호");
    const all = JSON.stringify(r);
    expect(all).not.toContain("1234567");
    expect(all).not.toContain("2234567");
    expect(r.documentWarnings.join(" ")).toContain("주민등록번호");
  });
});

describe("parseLeaseContract — 상가·숫자 금액", () => {
  const f = byKey(parseLeaseContract(SHOP_LEASE).fields);
  it("金 숫자·평 표기·부가세 별도", () => {
    expect(f.소재지?.value).toBe("경기도 평택시 예시로 12 (예시동)");
    expect(f.임차보증금?.value).toBe("3,000만");
    expect(f.임차월세?.value).toBe("150만");
    expect(f.임차월세?.warnings.join(" ")).toContain("부가세 별도");
    expect(f.임차면적?.value).toBe("66.12㎡(20평)");
    expect(f.소유여부?.value).toBe("임차 : 보 3000만, 월 150만");
  });
});

describe("parseLeaseContract — 불확실", () => {
  it("한글·숫자가 다르게 읽히면 확신도를 낮춘다", () => {
    const text = ["임대차계약서", "보증금 금 일천만원정 (₩10,000,00)", "차임 금 오십만원"].join("\n");
    const f = byKey(parseLeaseContract(text).fields);
    expect(f.임차보증금?.value).toBe("1,000만");
    expect(f.임차보증금?.confidence).toBeLessThan(0.5);
    expect(f.임차보증금?.warnings.join(" ")).toContain("여러 개");
    expect(f.소유여부?.confidence).toBeLessThan(0.5);
  });
  it("전세(월세 없음) — 소유여부는 보증금만", () => {
    const text = ["부동산 임대차 계약서", "소재지", "서울특별시 중구 예시로 5", "보증금", "금 이억원정"].join("\n");
    const r = parseLeaseContract(text);
    const f = byKey(r.fields);
    expect(f.임차보증금?.value).toBe("2억");
    expect(f.임차월세).toBeUndefined();
    expect(f.소유여부?.value).toBe("임차 : 보 2억");
    expect(f.소재지?.warnings.join(" ")).toContain("다음 줄");
  });
  it("임대할 부분이 없으면 가장 작은 면적을 낮은 확신도로", () => {
    const text = ["임대차계약서", "토지 면적 330㎡", "건물 면적 99㎡"].join("\n");
    const f = byKey(parseLeaseContract(text).fields);
    expect(f.임차면적?.value).toBe("99㎡(29.9평)");
    expect(f.임차면적?.confidence).toBeLessThan(0.5);
  });
  it("한 줄에 보증금·월세가 함께 — 서로의 금액을 빌려오지 않는다", () => {
    const text = ["월세 계약서 임대차계약서", "보증금 1,000만원 월세 50만원 관리비 5만원"].join("\n");
    const f = byKey(parseLeaseContract(text).fields);
    expect(f.임차보증금?.value).toBe("1,000만");
    expect(f.임차보증금?.confidence).toBeGreaterThan(0.5);
    expect(f.임차월세?.value).toBe("50만");
    expect(f.소유여부?.value).toBe("임차 : 보 1000만, 월 50만");
  });
  it("부가세 체크를 못 읽으면 경고", () => {
    const text = ["임대차계약서", "월세 금 오십만원 (부가세 □불포함 □포함)"].join("\n");
    const f = byKey(parseLeaseContract(text).fields);
    expect(f.임차월세?.warnings.join(" ")).toContain("체크");
  });
  it("빈 텍스트·무관한 텍스트", () => {
    expect(parseLeaseContract("").documentWarnings[0]).toContain("읽힌 글자가 없어요");
    const r = parseLeaseContract("아무 글자\n임대인은 보증금을 반환한다\n위약금 금 오백만원");
    expect(r.fields).toEqual([]);
    expect(r.documentWarnings.join(" ")).toContain("찾지 못했어요");
  });
});
