/**
 * 문서로 자동입력 — redactOcrText(state 에 두기 전 가리기) 회귀 테스트.
 * ① 주민등록번호·운전면허번호의 OCR 변형(대시 누락·오독·공백)도 가린다.
 * ② 다른 문서(재무제표·부가세·임대차)의 금액·날짜는 지우지 않는다 — 팝업과 같은 경로
 *    (redactOcrText → parseDocument)로 읽어도 원문으로 읽은 결과와 같아야 한다.
 * 합성 데이터만(예시상사·홍길동·가짜 번호). 네트워크 없음.
 */
import { describe, expect, it } from "vitest";
import { parseDocument } from "@/lib/document-ocr/registry";
import { parseVatCertificate } from "@/lib/document-ocr/parse-vat";
import { redactOcrText } from "@/lib/document-ocr/text-utils";
import type { DocParseResult, DocType } from "@/lib/document-ocr/types";

const NL = String.fromCharCode(10);
const digitsOf = (s: string) => s.replace(/\D/g, "");
const dump = (r: DocParseResult) => JSON.stringify(r);

describe("redactOcrText — 주민등록번호 OCR 변형", () => {
  it.each([
    ["대시 누락 + 뒷자리 공백", "주민등록번호 800101 1 234 567"],
    ["대시 누락(라벨 없음)", "홍길동 800101 1234567"],
    ["대시를 _ 로 오독", "800101_1234567"],
    ["대시를 . 로 오독", "800101.1234567"],
    ["대시를 ~ 로 오독", "800101 ~ 1234567"],
    ["대시 + 공백 노이즈", "800101 - 1 234 567"],
  ])("%s → 앞 6자리만 남는다", (_, raw) => {
    const red = redactOcrText(raw);
    expect(digitsOf(red)).toBe("800101");
    expect(red).toContain("800101-*******");
  });

  it("라벨 줄에서는 뒷자리가 덜 읽힌 부분 번호도 가린다", () => {
    const red = redactOcrText("주민등록번호 800101-12345");
    expect(digitsOf(red)).toBe("800101");
  });

  it("대시 누락 번호도 신분증 파서가 앞자리·생년월일을 읽는다(팝업 경로)", () => {
    const raw = ["주민등록증", "홍길동", "주민등록번호 800101 1 234 567", "서울특별시 강남구 예시대로 100"].join(NL);
    const r = parseDocument("신분증", redactOcrText(raw))!;
    const f = Object.fromEntries(r.fields.map((x) => [x.key, x.value]));
    expect(f.주민등록번호).toBe("800101-");
    expect(f.대표자생년월일).toBe("80.01.01");
    expect(digitsOf(dump(r))).not.toContain("1234567");
  });
});

describe("redactOcrText — 운전면허번호 OCR 변형", () => {
  it("면허번호 라벨 뒤는 공백 구분이어도 가린다", () => {
    const red = redactOcrText("면허번호 11 12 345678 90");
    expect(digitsOf(red)).toBe("");
    expect(red).toContain("면허번호");
  });

  it("지역명 옛 양식은 가리고, 계좌번호 같은 긴 대시 번호의 꼬리는 면허번호로 보지 않는다", () => {
    expect(digitsOf(redactOcrText("서울 12-345678-90"))).toBe("");
    const acct = "계좌 123-12-345678-90 보증금 금 일천만원정";
    expect(redactOcrText(acct)).toBe(acct);
  });
});

describe("redactOcrText — 다른 문서의 숫자는 건드리지 않는다", () => {
  it("음수 전기 값·날짜 범위·공백 낀 금액은 그대로", () => {
    for (const s of [
      "영업이익 120000 -45000",
      "당기순이익 250000 -32000",
      "과세표준 1 234 567 - 1 234 567",
      "25 01 01 - 25 06 30",
      "2025.01.01 ~ 2025.06.30 확정 125,000,000",
    ]) {
      expect(redactOcrText(s)).toBe(s);
    }
  });

  const FS = [
    "표준재무제표증명",
    "사업연도 2025년 01월 01일 ~ 2025년 12월 31일",
    "(단위 : 원)",
    "과 목  당기  전기",
    "자산총계 500000000 400000000",
    "부채총계 300000000 250000000",
    "자본총계 200000000 150000000",
    "매출액 900000000 800000000",
    "영업이익(손실) 120000 -45000",
    "이자비용 60000 50000",
    "당기순이익(손실) 250000 -32000",
  ].join(NL);
  const VAT = [
    "부가가치세 과세표준증명",
    "과세기간  신고구분  신고일  과세표준  납부할세액",
    "2025년 2기  확정  2026-01-25  130,000,000  12,000,000",
    "2025년 1기  확정  2025-07-25  120,000,000  11,000,000",
  ].join(NL);
  const LEASE = [
    "부동산 임대차 계약서",
    "소재지 서울특별시 중구 예시로 1, 예시빌딩",
    "임대할부분 1층 101호 면적 33 ㎡",
    "보증금 금 일천만원정 ( ₩10,000,000 )",
    "차임 금 오십만원정 ( ₩500,000 ) 은 매월 말일에 지불한다.",
    "계좌 123-12-345678-90",
  ].join(NL);

  it.each([
    ["재무제표", FS],
    ["부가세과세표준증명", VAT],
    ["임대차계약서", LEASE],
  ] as [DocType, string][])("%s: 가린 원문으로 읽어도 결과가 같다", (type, text) => {
    const plain = parseDocument(type, text)!;
    const viaPopup = parseDocument(type, redactOcrText(text))!;
    expect(viaPopup.fields.map((f) => [f.key, f.value])).toEqual(plain.fields.map((f) => [f.key, f.value]));
  });

  it("재무제표: 음수 전기 값이 있어도 영업이익·당기순이익이 남는다", () => {
    const r = parseDocument("재무제표", redactOcrText(FS))!;
    const keys = r.fields.map((f) => f.key);
    expect(keys).toContain("영업이익");
    expect(keys).toContain("당기순이익");
  });
});

describe("부가세 — 음수 과세표준 줄", () => {
  const TODAY = new Date(2026, 8, 28);
  it.each(["-5,000,000", "△5,000,000"])("%s 줄은 다음 칸(납부세액)을 매출로 읽지 않고 빼며 경고한다", (neg) => {
    const text = ["과세기간 과세표준", `2025.01.01~2025.06.30 확정 2025.07.25 ${neg} 300,000`].join(NL);
    const r = parseVatCertificate(text, { today: TODAY });
    expect(r.fields.find((f) => f.key === "매출Y1상")).toBeUndefined();
    expect(r.fields.find((f) => f.key === "과년도매출")).toBeUndefined();
    expect(r.documentWarnings.join(" ")).toContain("마이너스");
  });

  it("음수 수정 줄이 있어도 같은 반기의 확정 금액은 그대로 쓴다", () => {
    const text = [
      "과세기간 과세표준",
      "2025.01.01~2025.06.30 확정 2025.07.25 120,000,000 11,000,000",
      "2025.01.01~2025.06.30 수정 2025.09.01 -5,000,000 300,000",
    ].join(NL);
    const r = parseVatCertificate(text, { today: TODAY });
    expect(r.fields.find((f) => f.key === "과년도매출")?.value).toBe("25' 120백만");
  });
});
