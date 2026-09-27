/**
 * 문서로 자동입력 — 순수 로직: 사업자등록번호·법인등록번호 검증, 문서 분류, 사업자등록증 파서, 레지스트리.
 * 네트워크 없음 · 합성 텍스트만.
 */
import { describe, expect, it } from "vitest";
import { findBizNoCandidates, formatBizNo, isValidBizNo, isValidCorpNo } from "@/lib/document-ocr/bizno";
import { parseBusinessCertificate } from "@/lib/document-ocr/parse-certificate";
import { classifyDocumentText, isSupportedDocType, parseDocument } from "@/lib/document-ocr/registry";
import { findCorpNo, redactOcrText } from "@/lib/document-ocr/text-utils";
import { validateOcrFile } from "@/lib/document-ocr/limits";
import type { ParsedField } from "@/lib/document-ocr/types";
import { BAD_BIZNO, CERT_WITH_RRN, CORP_CERT, LEASE_TEXT, PERSONAL_CERT, VALID_BIZNO, VALID_CORPNO } from "./fixtures";

const byKey = (fields: ParsedField[]) => Object.fromEntries(fields.map((f) => [f.key, f]));

describe("bizno", () => {
  it("사업자등록번호 검증식", () => {
    expect(isValidBizNo(VALID_BIZNO)).toBe(true);
    expect(isValidBizNo("1234567891")).toBe(true);
    expect(isValidBizNo(BAD_BIZNO)).toBe(false);
    expect(isValidBizNo("000-00-00000")).toBe(false);
    expect(isValidBizNo("123-45-678")).toBe(false);
    expect(formatBizNo("1234567891")).toBe(VALID_BIZNO);
  });
  it("후보 찾기 — 대시형·연속 10자리, 13자리는 제외", () => {
    expect(findBizNoCandidates(`번호 ${VALID_BIZNO} 그리고 9876543210`)).toEqual([VALID_BIZNO, "9876543210"]);
    expect(findBizNoCandidates("8001011234567")).toEqual([]);
  });
  it("법인등록번호 검증식", () => {
    expect(isValidCorpNo(VALID_CORPNO)).toBe(true);
    expect(isValidCorpNo("110111-1234560")).toBe(false);
  });
});

describe("classifyDocumentText", () => {
  it.each([
    [PERSONAL_CERT, "사업자등록증"],
    ["부가가치세 과세표준증명\n사업자등록번호 123-45-67891", "부가세과세표준증명"],
    ["표준재무제표증명\n재무상태표", "재무제표"],
    ["손 익 계 산 서\n매출액", "재무제표"],
    ["주민등록증\n홍길동", "신분증"],
    ["자동차운전면허증\n홍길동", "신분증"],
    [LEASE_TEXT, "임대차계약서"],
    ["아무 글자", "unknown"],
    ["", "unknown"],
  ])("%#", (text, want) => {
    expect(classifyDocumentText(text)).toBe(want);
  });
  it("제목(먼저 나온 키워드)이 이긴다 — 임대차계약서 본문의 '사업자등록증' 언급", () => {
    expect(classifyDocumentText(`${LEASE_TEXT}\n첨부: 사업자등록증 사본`)).toBe("임대차계약서");
  });
});

describe("parseBusinessCertificate — 개인", () => {
  const r = parseBusinessCertificate(PERSONAL_CERT);
  const f = byKey(r.fields);
  it("업체정보 키·형식으로 낸다", () => {
    expect(f.대표자이름?.value).toBe("홍길동");
    expect(f.사업자등록번호?.value).toBe(VALID_BIZNO);
    expect(f.사업자등록번호?.valid).toBe(true);
    expect(f.개업일?.value).toBe("20.03.02");
    expect(f.대표자생년월일?.value).toBe("80.01.01");
    expect(f.소재지?.value).toBe("서울특별시 중구 예시로 1, 2층");
    expect(f.업태?.value).toBe("도매 및 소매업");
    expect(f.업종주생산품목?.value).toBe("전자상거래");
    expect(f.과세유형?.value).toBe("일반과세자");
    expect(f.사업자구분?.value).toBe("개인");
    expect(f.법인등록번호).toBeUndefined();
  });
  it("상호는 저장 칸이 아니라 참고 정보로만", () => {
    expect(r.info).toEqual([{ label: "상호", value: "예시상사" }]);
    expect(r.fields.some((x) => (x.key as string) === "상호")).toBe(false);
  });
  it("정확도는 0~1", () => {
    for (const x of r.fields) expect(x.confidence).toBeGreaterThan(0), expect(x.confidence).toBeLessThanOrEqual(1);
  });
});

describe("parseBusinessCertificate — 법인", () => {
  const r = parseBusinessCertificate(CORP_CERT);
  const f = byKey(r.fields);
  it("법인등록번호·사업자구분 법인", () => {
    expect(f.법인등록번호?.value).toBe(VALID_CORPNO);
    expect(f.법인등록번호?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(f.사업자구분?.value).toBe("법인");
    expect(f.대표자이름?.value).toBe("홍길동");
    expect(f.개업일?.value).toBe("19.07.15");
    expect(f.소재지?.value).toBe("서울특별시 강남구 예시대로 100");
    expect(f.업태?.value).toBe("제조업");
    expect(f.업종주생산품목?.value).toBe("필름");
    expect(f.과세유형).toBeUndefined();
    expect(r.info?.[0]).toEqual({ label: "상호", value: "예시상사 주식회사" });
  });
  it("법인등록번호 없이 '(법인사업자)' 만 있어도 법인", () => {
    const g = byKey(parseBusinessCertificate(CORP_CERT.replace(/법인등록번호.*\n/, "")).fields);
    expect(g.법인등록번호).toBeUndefined();
    expect(g.사업자구분?.value).toBe("법인");
  });
});

describe("parseBusinessCertificate — 개인정보·오독", () => {
  it("주민등록번호 뒷자리는 어떤 값에도 남지 않고, 생년월일로 추측하지 않는다", () => {
    const r = parseBusinessCertificate(CERT_WITH_RRN);
    expect(JSON.stringify(r)).not.toContain("1234567");
    expect(JSON.stringify(r)).not.toContain("800101");
    const f = byKey(r.fields);
    expect(f.대표자생년월일).toBeUndefined();
    expect(f.주민등록번호).toBeUndefined();
    expect(f.개업일?.value).toBe("21.05.06");
    expect(f.과세유형?.value).toBe("간이과세자");
    expect(r.documentWarnings.join(" ")).toContain("주민등록번호는 읽지 않았어요");
  });
  it("검증식이 틀린 사업자등록번호는 valid=false·낮은 정확도", () => {
    const f = byKey(parseBusinessCertificate(PERSONAL_CERT.replace(VALID_BIZNO, BAD_BIZNO)).fields);
    expect(f.사업자등록번호?.valid).toBe(false);
    expect(f.사업자등록번호?.confidence).toBeLessThan(0.5);
    expect(f.사업자등록번호?.warnings.join(" ")).toContain("검증");
  });
  it("빈 텍스트는 칸 없이 안내만", () => {
    const r = parseBusinessCertificate("   ");
    expect(r.fields).toEqual([]);
    expect(r.documentWarnings.length).toBe(1);
  });
});

describe("registry", () => {
  it("사업자등록증만 등록 — 나머지는 null(곧 지원돼요)", () => {
    expect(isSupportedDocType("사업자등록증")).toBe(true);
    for (const t of ["부가세과세표준증명", "재무제표", "신분증", "임대차계약서", "unknown"] as const) {
      expect(isSupportedDocType(t)).toBe(false);
      expect(parseDocument(t, PERSONAL_CERT)).toBeNull();
    }
    expect(parseDocument("사업자등록증", PERSONAL_CERT)?.fields.length).toBeGreaterThan(5);
  });
});

describe("validateOcrFile", () => {
  it("형식·크기", () => {
    expect(validateOcrFile({ size: 10, type: "image/png" })).toEqual({ kind: "image" });
    expect(validateOcrFile({ size: 10, type: "", name: "a.PDF" })).toEqual({ kind: "pdf" });
    expect(validateOcrFile({ size: 16 * 1024 * 1024, type: "image/png" })).toHaveProperty("error.code", "too-large");
    expect(validateOcrFile({ size: 10, type: "text/plain", name: "a.txt" })).toHaveProperty("error.code", "unsupported-type");
    expect(validateOcrFile({ size: 0, type: "image/png" })).toHaveProperty("error.code", "empty");
  });
});

describe("법인등록번호 — 다른 번호 줄을 빌려오지 않는다(리뷰 회귀)", () => {
  it("라벨 값이 비고 다음 줄이 주민등록번호면 법인등록번호·법인 구분을 내지 않는다", () => {
    const text = ["사업자등록증", `등록번호 : ${VALID_BIZNO}`, "성명 : 홍길동", "법인등록번호 :", "주민등록번호 : 800101-1234567"].join("\n");
    const out = parseBusinessCertificate(text);
    const k = byKey(out.fields);
    expect(k.법인등록번호).toBeUndefined();
    expect(k.사업자구분?.value).not.toBe("법인");
    expect(JSON.stringify(out)).not.toContain("1234567");
    expect(findCorpNo(text)).toBe("");
  });
  it("라벨 다음 줄에 번호만 있으면 읽는다", () => {
    expect(findCorpNo(`법인등록번호 :\n${VALID_CORPNO}`)).toBe(VALID_CORPNO.replace("-", ""));
  });
  it("검증식이 틀린 법인등록번호는 valid=false(기본 해제) 이고 법인 구분 근거로 쓰지 않는다", () => {
    const text = ["사업자등록증", "상호 : 예시상사", "법인등록번호 : 110111-1234560"].join("\n");
    const k = byKey(parseBusinessCertificate(text).fields);
    expect(k.법인등록번호).toMatchObject({ value: "110111-1234560", valid: false });
    expect(k.사업자구분).toBeUndefined();
  });
});

describe("redactOcrText — state 에 두기 전 가리기", () => {
  it("주민등록번호 뒷자리·운전면허번호는 가리고 법인등록번호는 남긴다", () => {
    const raw = [...CORP_CERT.split("\n"), "주민등록번호 : 800101-1234567", "면허번호 11-22-333333-44"].join("\n");
    const red = redactOcrText(raw);
    expect(red).not.toContain("1234567");
    expect(red).toContain("800101-*******");
    expect(red).not.toContain("333333");
    expect(red).toContain(VALID_CORPNO);
    // 가린 글로 읽어도 결과는 같다.
    expect(byKey(parseBusinessCertificate(red).fields).법인등록번호?.value).toBe(VALID_CORPNO);
  });
});
