/**
 * MSC 이식(2026-11-01) — 합본 PDF 나누기 · 깨진 글자층 판정 · 다른 회사 서류 경고 · 묶음 되돌리기.
 * 네트워크 없음 · 합성 텍스트만(실제 고객 서류 없음).
 */
import { describe, expect, it } from "vitest";
import { segmentName, splitBundlePages } from "@/lib/document-ocr/bundle";
import { buildDiffRows, OTHER_COMPANY_NOTE, otherCompanyFiles } from "@/lib/document-ocr/diff";
import { isGarbledText } from "@/lib/document-ocr/text-utils";
import { docFillOf, undoPatch, untouchedKeys } from "@/lib/document-ocr/undo";
import type { ParsedField } from "@/lib/document-ocr/types";
import { LEASE_TEXT, PERSONAL_CERT, VALID_BIZNO } from "./fixtures";

const OTHER_BIZNO = "220-81-00016"; // 검증식 통과하는 가짜 번호

const VAT_PAGE = ["부가가치세 과세표준증명", "발급번호 1111-2222", "과세기간 2025/01/01 ~ 2025/06/30 100,000,000"].join("\n");
const FS_COVER = ["표준재무제표증명", "발급번호 3333-4444", "사업연도 2025년 01월 01일부터 2025년 12월 31일까지"].join("\n");
const FS_BODY = ["재무상태표", "자산총계 500,000,000"].join("\n");
const FS_INCOME = ["손익계산서", "매출액 900,000,000"].join("\n");
const PLAIN = "이어지는 쪽\n금액 표 계속";

describe("splitBundlePages — 합본 PDF", () => {
  it("서로 다른 서류 3종(사업자등록증·부가세·재무제표 3쪽) → 3조각", () => {
    const segs = splitBundlePages([PERSONAL_CERT, VAT_PAGE, FS_COVER, FS_BODY, FS_INCOME]);
    expect(segs.map((s) => [s.docType, s.from, s.to])).toEqual([
      ["사업자등록증", 1, 1],
      ["부가세과세표준증명", 2, 2],
      ["재무제표", 3, 5],
    ]);
    expect(segs[2]!.text).toContain("매출액 900,000,000");
  });
  it("제목 없는 쪽은 앞 서류에 붙는다", () => {
    const segs = splitBundlePages([LEASE_TEXT, PLAIN, PERSONAL_CERT]);
    expect(segs.map((s) => [s.docType, s.from, s.to])).toEqual([
      ["임대차계약서", 1, 2],
      ["사업자등록증", 3, 3],
    ]);
  });
  it("같은 단일 쪽 서류가 이어지면 따로(사업자등록증 두 장)", () => {
    expect(splitBundlePages([PERSONAL_CERT, PERSONAL_CERT])).toHaveLength(2);
  });
  it("쪽 표시 1/2·2/2 는 한 서류", () => {
    const p1 = `${PERSONAL_CERT}\n1/2`;
    const p2 = `사업자등록증\n추가 사항\n2/2`;
    expect(splitBundlePages([p1, p2])).toHaveLength(1);
  });
  it("발급번호가 다른 재무제표 두 벌은 둘로", () => {
    const other = FS_COVER.replace("3333-4444", "5555-6666").replace("2025년", "2024년");
    expect(splitBundlePages([FS_COVER, FS_BODY, other, FS_BODY])).toHaveLength(2);
  });
  it("나눌 근거가 없으면 한 조각(이름 그대로)", () => {
    const segs = splitBundlePages([FS_COVER, FS_BODY]);
    expect(segs).toHaveLength(1);
    expect(segmentName("a.pdf", segs[0]!, 2)).toBe("a.pdf");
    expect(segmentName("a.pdf", { from: 3, to: 5, docType: "재무제표", text: "" }, 5)).toBe("a.pdf (3~5쪽)");
    expect(segmentName("a.pdf", { from: 2, to: 2, docType: "재무제표", text: "" }, 5)).toBe("a.pdf (2쪽)");
  });
});

describe("isGarbledText — 깨진 글자층", () => {
  it("글꼴 번호·사용자 영역 글자만 나오면 깨짐", () => {
    expect(isGarbledText("/12/34/56/78 /90/11/23/45 /67/89 abc")).toBe(true);
    expect(isGarbledText(String.fromCharCode(0xe001).repeat(30))).toBe(true);
  });
  it("한글이 충분하면 정상, 짧은 글은 판정 안 함", () => {
    expect(isGarbledText(PERSONAL_CERT)).toBe(false);
    expect(isGarbledText("/1/2")).toBe(false);
  });
});

const biz = (value: string): ParsedField => ({ key: "사업자등록번호", value, confidence: 0.9, warnings: [] });
const name = (value: string): ParsedField => ({ key: "대표자이름", value, confidence: 0.9, warnings: [] });

describe("otherCompanyFiles — 다른 회사 서류", () => {
  const proposals = [
    { fileName: "a.pdf", fields: [biz(VALID_BIZNO), name("홍길동")] },
    { fileName: "b.pdf", fields: [biz(OTHER_BIZNO), name("김가상")] },
  ];
  it("업체정보 번호와 다르면 표시하고, 그 서류에서만 나온 값은 기본 체크 해제", () => {
    const other = otherCompanyFiles(VALID_BIZNO, proposals);
    expect([...other]).toEqual([["b.pdf", OTHER_BIZNO]]);
    const rows = buildDiffRows({}, proposals, [], new Set(other.keys()));
    const nameRow = rows.find((r) => r.key === "대표자이름")!;
    // 정확도가 같아 a.pdf 값이 앞이면 체크, b.pdf 값만 있는 칸이면 해제
    expect(nameRow.conflict).toBe(true);
    const onlyOther = buildDiffRows({}, [proposals[1]!], [], new Set(["b.pdf"]));
    expect(onlyOther.every((r) => !r.defaultChecked && r.note === OTHER_COMPANY_NOTE)).toBe(true);
  });
  it("업체정보 번호가 없으면 가장 많이 나온 번호가 기준", () => {
    const three = [...proposals, { fileName: "c.pdf", fields: [biz(OTHER_BIZNO)] }];
    expect([...otherCompanyFiles("", three).keys()]).toEqual(["a.pdf"]);
  });
  it("검증식이 틀린 번호(오독)는 다른 회사로 보지 않는다", () => {
    const bad = [...proposals.slice(0, 1), { fileName: "d.pdf", fields: [biz("123-45-67890")] }];
    expect(otherCompanyFiles(VALID_BIZNO, bad).size).toBe(0);
  });
});

describe("undo — 묶음 되돌리기", () => {
  it("아직 문서 값 그대로인 칸만 이전 값으로", () => {
    const before = { 대표자이름: "", 업태: "기존업태" };
    const fill = docFillOf(before, { 대표자이름: "홍길동", 업태: "도매" });
    const after = { 대표자이름: "홍길동", 업태: "직접고침" };
    expect(untouchedKeys(fill, after)).toEqual(["대표자이름"]);
    expect(undoPatch(fill, after)).toEqual({ 대표자이름: "" });
  });
  it("이미 같은 값이던 칸은 표시·되돌리기 대상이 아니다", () => {
    const fill = docFillOf({ 업태: "도매" }, { 업태: "도매" });
    expect(untouchedKeys(fill, { 업태: "도매" })).toEqual([]);
  });
});
