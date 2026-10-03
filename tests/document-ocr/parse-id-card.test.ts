/**
 * 신분증 파서 — 합성 OCR 텍스트만(홍길동·예시로). 실제 개인정보 아님.
 * 핵심 불변식: 주민등록번호 뒷자리 7자리·운전면허번호는 결과 어디에도(값·경고·문서경고) 나오지 않는다.
 */
import { describe, expect, it } from "vitest";
import { centuryFromSeventh, parseIdCard, stripSensitiveNumbers } from "@/lib/document-ocr/parse-id-card";
import { parseDocument } from "@/lib/document-ocr/registry";
import { redactOcrText } from "@/lib/document-ocr/text-utils";
import type { DocParseResult, ParsedField } from "@/lib/document-ocr/types";

const NOW = new Date("2026-09-28T00:00:00Z");
const byKey = (fields: ParsedField[]) => Object.fromEntries(fields.map((f) => [f.key, f]));
const dump = (r: DocParseResult) => JSON.stringify(r);

/** 뒷자리·면허번호가 어떤 형태(공백·대시 제거 포함)로도 결과에 없는지. */
function expectNoSecrets(r: DocParseResult, secrets: string[]) {
  const all = dump(r);
  const allDigits = all.replace(/\D/g, "");
  for (const s of secrets) {
    expect(all).not.toContain(s);
    expect(allDigits).not.toContain(s.replace(/\D/g, ""));
  }
}

const RESIDENT_CARD = [
  "주 민 등 록 증",
  "홍 길 동 (洪吉童)",
  "8 0 0 1 0 1 - 1 2 3 4 5 6 7",
  "서울특별시 중구 예시로 1",
  "101동 202호 (예시동)",
  "2020. 3. 5.",
  "서울특별시 중구청장",
].join("\n");

const DRIVER_LICENSE = [
  "자동차운전면허증",
  "Driver's License",
  "1종보통",
  "11-12-345678-90",
  "홍길동",
  "800101-1******",
  "서울특별시 강남구 예시대로 100",
  "예시아파트 3동 405호",
  "적성검사기간 2030.01.01~2030.12.31",
  "2020.03.05",
  "서울지방경찰청장",
  "식별번호 AB12CD",
].join("\n");

describe("parseIdCard — 주민등록증", () => {
  const r = parseIdCard(RESIDENT_CARD, { now: NOW });
  const f = byKey(r.fields);
  it("이름·생년월일·앞자리·두 줄 주소", () => {
    expect(f.대표자이름?.value).toBe("홍길동");
    expect(f.주민등록번호?.value).toBe("800101-");
    expect(f.주민등록번호?.valid).toBe(true);
    expect(f.대표자생년월일?.value).toBe("80.01.01");
    expect(f.대표자생년월일?.warnings).toEqual([]);
    expect(f.자택주소지?.value).toBe("서울특별시 중구 예시로 1 101동 202호 (예시동)");
  });
  it("뒷자리는 어디에도 없다", () => {
    expectNoSecrets(r, ["1234567"]);
  });
});

describe("parseIdCard — 운전면허증", () => {
  const r = parseIdCard(DRIVER_LICENSE, { now: NOW });
  const f = byKey(r.fields);
  it("면허번호 끝자리를 주민번호로 오인하지 않는다", () => {
    expect(f.주민등록번호?.value).toBe("800101-");
    expect(f.대표자생년월일?.value).toBe("80.01.01");
    expect(f.대표자이름?.value).toBe("홍길동");
    expect(f.자택주소지?.value).toBe("서울특별시 강남구 예시대로 100 예시아파트 3동 405호");
  });
  it("운전면허번호·식별번호는 어디에도 없다", () => {
    expectNoSecrets(r, ["11-12-345678-90", "345678", "AB12CD"]);
  });
  it("지역명 옛 양식 면허번호도 지운다", () => {
    const old = DRIVER_LICENSE.replace("11-12-345678-90", "서울 12-345678-90");
    const r2 = parseIdCard(old, { now: NOW });
    expect(byKey(r2.fields).주민등록번호?.value).toBe("800101-");
    expectNoSecrets(r2, ["345678"]);
  });
});

describe("parseIdCard — 세기·노이즈", () => {
  it("2000년대생(7번째 3) — 대시 없는 13자리", () => {
    const r = parseIdCard("주민등록증\n김예시\n0503153234567\n부산광역시 해운대구 예시로 5", { now: NOW });
    const f = byKey(r.fields);
    expect(f.주민등록번호?.value).toBe("050315-");
    expect(f.대표자생년월일?.value).toBe("05.03.15");
    expect(f.대표자생년월일?.warnings).toEqual([]);
    expectNoSecrets(r, ["3234567"]);
  });
  it("7번째 자리가 가려지면 추정하고 경고(YY>올해 → 19xx)", () => {
    const r = parseIdCard("주민등록증\n홍길동\n800101-*******\n서울특별시 중구 예시로 1", { now: NOW });
    const f = byKey(r.fields);
    expect(f.대표자생년월일?.value).toBe("80.01.01");
    expect(f.대표자생년월일?.warnings.join()).toContain("1900");
  });
  it("YY<=올해 이고 가려지면 20xx 로 추정", () => {
    const r = parseIdCard("주민등록증\n홍길동\n200229 - ●●●●●●●\n서울특별시 중구 예시로 1", { now: NOW });
    const f = byKey(r.fields);
    expect(f.대표자생년월일?.value).toBe("20.02.29"); // 2020 은 윤년 → 유효
    expect(f.대표자생년월일?.warnings.join()).toContain("2000");
  });
  it("세기 규칙", () => {
    expect(centuryFromSeventh("1")).toBe(1900);
    expect(centuryFromSeventh("6")).toBe(1900);
    expect(centuryFromSeventh("4")).toBe(2000);
    expect(centuryFromSeventh("8")).toBe(2000);
    expect(centuryFromSeventh("9")).toBe(1800);
    expect(centuryFromSeventh("0")).toBe(1800);
    expect(centuryFromSeventh(null)).toBeNull();
  });
  it("날짜가 아닌 앞자리는 valid=false, 생년월일은 비운다", () => {
    const r = parseIdCard("주민등록증\n홍길동\n801399-1234567", { now: NOW });
    const f = byKey(r.fields);
    expect(f.주민등록번호?.valid).toBe(false);
    expect(f.대표자생년월일).toBeUndefined();
    expectNoSecrets(r, ["1234567"]);
  });
  it("번호와 이름이 한 줄에 붙어 읽혀도 이름을 찾는다", () => {
    const r = parseIdCard("주민등록증\n홍길동 800101-2345678\n대전광역시 서구 예시로 7", { now: NOW });
    const f = byKey(r.fields);
    expect(f.대표자이름?.value).toBe("홍길동");
    expect(f.자택주소지?.value).toBe("대전광역시 서구 예시로 7");
    expectNoSecrets(r, ["2345678"]);
  });
  it("이름에 '종' 이 들어가도 된다", () => {
    const r = parseIdCard("주민등록증\n김종민\n800101-1234567", { now: NOW });
    expect(byKey(r.fields).대표자이름?.value).toBe("김종민");
  });
  it("주소 라벨이 있으면 라벨 값(+다음 줄)을 쓴다", () => {
    const text = ["주민등록증", "성명: 홍길동", "주소: 광주광역시 북구 예시로 3", "(예시동)", "800101-1234567"].join("\n");
    const r = parseIdCard(text, { now: NOW });
    const f = byKey(r.fields);
    expect(f.대표자이름?.value).toBe("홍길동");
    expect(f.자택주소지?.value).toBe("광주광역시 북구 예시로 3 (예시동)");
    expectNoSecrets(r, ["1234567"]);
  });
  it("빈 텍스트·번호 없음", () => {
    expect(parseIdCard("", { now: NOW }).fields).toEqual([]);
    const r = parseIdCard("주민등록증\n홍길동", { now: NOW });
    expect(byKey(r.fields).대표자이름?.value).toBe("홍길동");
    expect(r.documentWarnings.join()).toContain("주민등록번호");
  });
});

describe("stripSensitiveNumbers", () => {
  it("주민번호 전체·면허번호를 지운다", () => {
    const out = stripSensitiveNumbers("800101-1234567\n11-12-345678-90\n면허번호 99-99-999999-99\n8001011234567");
    expect(out.replace(/\D/g, "")).toBe("");
  });
});

describe("신분증 — 팝업 경로(가린 원문 → 레지스트리)에서도 새지 않는다", () => {
  const RAW = [
    "자동차운전면허증",
    "서울 12-345678-90",
    "홍길동",
    "800101-1  234 567",
    "서울특별시 강남구 예시대로 100",
  ].join(String.fromCharCode(10));

  it("뒷자리 사이 공백이 여러 칸이어도 파서가 통째로 지운다", () => {
    const r = parseIdCard(RAW, { now: NOW });
    expect(byKey(r.fields).주민등록번호?.value).toBe("800101-");
    expectNoSecrets(r, ["1234567", "234567", "12-345678-90", "34567890"]);
  });

  it("redactOcrText 가 뒷자리·면허번호를 먼저 가리고, 레지스트리 파서는 앞자리만 낸다", () => {
    const masked = redactOcrText(RAW);
    expect(masked.replace(/[^0-9]/g, "")).not.toContain("234567");
    expect(masked).not.toContain("345678");
    const r = parseDocument("신분증", masked)!;
    const f = byKey(r.fields);
    expect(f.주민등록번호?.value).toBe("800101-");
    expect(f.대표자생년월일?.value).toBe("80.01.01");
    expect(f.대표자생년월일?.warnings.join()).toContain("1900");
    expect(f.대표자이름?.value).toBe("홍길동");
    expectNoSecrets(r, ["1234567", "12-345678-90"]);
  });

  it("법인등록번호 라벨 값은 가리지 않는다(사업자등록증 경로 보존)", () => {
    const text = ["법인등록번호 110111-1234569", "대표자 홍길동 800101 - 1 234 567"].join(String.fromCharCode(10));
    const masked = redactOcrText(text);
    expect(masked).toContain("110111-1234569");
    expect(masked).toContain("800101-*******");
  });
});
