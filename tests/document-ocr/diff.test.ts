/**
 * 문서로 자동입력 — 비교표 기본 체크·충돌 해소·반영값 뽑기(순수 함수).
 */
import { describe, expect, it } from "vitest";
import { CompanyInfo } from "@/types";
import {
  INVALID_NOTE,
  KEEP_NOTE,
  SAME_NOTE,
  accuracyOf,
  buildDiffRows,
  checkState,
  defaultCheckFor,
  selectedPatch,
} from "@/lib/document-ocr/diff";
import type { ParsedField } from "@/lib/document-ocr/types";

const f = (key: ParsedField["key"], value: string, confidence = 0.85, extra: Partial<ParsedField> = {}): ParsedField => ({
  key,
  value,
  confidence,
  warnings: [],
  ...extra,
});
const cur = (p: Partial<CompanyInfo> = {}) => ({ ...CompanyInfo.parse({}), ...p });
const rowOf = (rows: ReturnType<typeof buildDiffRows>, k: string) => rows.find((r) => r.key === k)!;

describe("buildDiffRows 기본 체크", () => {
  const rows = buildDiffRows(
    cur({ 소재지: "서울 어딘가", 업태: "도매" }),
    [
      {
        fileName: "a.jpg",
        fields: [
          f("대표자이름", "홍길동"),
          f("소재지", "서울특별시 중구 예시로 1"),
          f("업태", "도매"),
          f("사업자등록번호", "123-45-67890", 0.3, { valid: false }),
          f("과세유형", ""),
        ],
      },
    ],
    ["사업자등록번호", "소재지", "대표자이름", "업태"],
  );
  it("지금 값이 비었고 읽은 값이 있으면 체크", () => {
    expect(rowOf(rows, "대표자이름").defaultChecked).toBe(true);
    expect(rowOf(rows, "대표자이름").note).toBe("");
  });
  it("지금 값이 있으면 체크 해제 + 안내", () => {
    expect(rowOf(rows, "소재지").defaultChecked).toBe(false);
    expect(rowOf(rows, "소재지").note).toBe(KEEP_NOTE);
  });
  it("지금 값과 같으면 체크 해제", () => {
    expect(rowOf(rows, "업태").defaultChecked).toBe(false);
    expect(rowOf(rows, "업태").note).toBe(SAME_NOTE);
  });
  it("검증 실패 번호는 비어 있어도 체크 해제", () => {
    expect(rowOf(rows, "사업자등록번호").defaultChecked).toBe(false);
    expect(rowOf(rows, "사업자등록번호").note).toBe(INVALID_NOTE);
  });
  it("빈 읽은 값은 행 자체가 없다", () => {
    expect(rows.find((r) => r.key === "과세유형")).toBeUndefined();
  });
  it("편집기 칸 순서대로 정렬", () => {
    expect(rows.map((r) => r.key)).toEqual(["사업자등록번호", "소재지", "대표자이름", "업태"]);
  });
});

describe("buildDiffRows 충돌", () => {
  it("두 파일이 다른 값을 내면 충돌 + 정확도 높은 값이 기본", () => {
    const rows = buildDiffRows(cur(), [
      { fileName: "a.jpg", fields: [f("대표자이름", "홍길돔", 0.4)] },
      { fileName: "b.pdf", fields: [f("대표자이름", "홍길동", 0.9)] },
    ]);
    const r = rowOf(rows, "대표자이름");
    expect(r.conflict).toBe(true);
    expect(r.candidates.map((c) => c.value)).toEqual(["홍길동", "홍길돔"]);
    expect(r.candidates[0]!.sources).toEqual(["b.pdf"]);
    expect(r.defaultChecked).toBe(true);
  });
  it("같은 값이면 하나로 합치고 출처를 모은다", () => {
    const rows = buildDiffRows(cur(), [
      { fileName: "a.jpg", fields: [f("업태", "제조업", 0.6)] },
      { fileName: "b.pdf", fields: [f("업태", "제조업", 0.8)] },
    ]);
    const r = rowOf(rows, "업태");
    expect(r.conflict).toBe(false);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0]!.sources).toEqual(["a.jpg", "b.pdf"]);
    expect(r.candidates[0]!.confidence).toBe(0.8);
  });
  it("검증 통과 값이 정확도와 무관하게 먼저", () => {
    const rows = buildDiffRows(cur(), [
      { fileName: "a", fields: [f("사업자등록번호", "123-45-67890", 0.95, { valid: false })] },
      { fileName: "b", fields: [f("사업자등록번호", "123-45-67891", 0.6, { valid: true })] },
    ]);
    expect(rowOf(rows, "사업자등록번호").candidates[0]!.value).toBe("123-45-67891");
    expect(rowOf(rows, "사업자등록번호").defaultChecked).toBe(true);
  });
});

describe("selectedPatch", () => {
  it("체크된 칸만, 고른 후보 값으로", () => {
    const rows = buildDiffRows(cur(), [
      { fileName: "a", fields: [f("대표자이름", "홍길돔", 0.4), f("업태", "제조업")] },
      { fileName: "b", fields: [f("대표자이름", "홍길동", 0.9), f("소재지", "서울")] },
    ]);
    expect(selectedPatch(rows, { 대표자이름: true, 업태: false, 소재지: true }, { 대표자이름: 1 })).toEqual({
      대표자이름: "홍길돔",
      소재지: "서울",
    });
  });
  it("주민등록번호 칸은 반영 직전에도 앞 6자리만", () => {
    const rows = buildDiffRows(cur(), [{ fileName: "a", fields: [f("주민등록번호", "800101-1234567")] }]);
    expect(rowOf(rows, "주민등록번호").candidates[0]!.value).toBe("800101-");
    expect(selectedPatch(rows, { 주민등록번호: true }, {})).toEqual({ 주민등록번호: "800101-" });
  });
});

describe("accuracyOf / defaultCheckFor", () => {
  it("구간", () => {
    expect(accuracyOf(0.9)).toBe("높음");
    expect(accuracyOf(0.6)).toBe("보통");
    expect(accuracyOf(0.3)).toBe("낮음");
  });
  it("후보를 바꾸면 기본 체크를 다시 계산", () => {
    expect(defaultCheckFor("", { value: "x", confidence: 0.5, warnings: [], sources: [] })).toBe(true);
    expect(defaultCheckFor("", { value: "x", confidence: 0.5, warnings: [], sources: [], valid: false })).toBe(false);
  });
});

describe("checkState — 충돌 행에서 고른 후보 기준 안내(리뷰 회귀)", () => {
  it("지금 값과 같은 후보 → SAME, 다른 후보 → KEEP", () => {
    const rows = buildDiffRows(CompanyInfo.parse({ 업태: "제조업" }), [
      { fileName: "a", fields: [f("업태", "제조업", 0.9)] },
      { fileName: "b", fields: [f("업태", "도매업", 0.6)] },
    ]);
    const row = rows[0]!;
    expect(row.conflict).toBe(true);
    expect(checkState(row.current, row.candidates[0]!).note).toBe(SAME_NOTE);
    expect(checkState(row.current, row.candidates[1]!).note).toBe(KEEP_NOTE);
    expect(checkState("", { value: "x", confidence: 0.4, warnings: [], sources: [], valid: false }).note).toBe(INVALID_NOTE);
  });
});
