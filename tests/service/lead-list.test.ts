/**
 * 발굴 목록 조회 순수 헬퍼 (lead-chain PR-2):
 *  ① sortLeadsByRecent — 접수일 내림차순, 동률은 row 내림차순(안정) ② filterLeads — 5필드 부분일치
 *  ③ selectLeadsForPicker — 검색 후 정렬 파이프라인. (I/O·matched 는 스코프 밖)
 */
import { describe, expect, it } from "vitest";
import {
  filterLeads,
  selectLeadsForPicker,
  sortLeadsByRecent,
  type LeadForPicker,
} from "@/service/lead-list";

function lead(over: Partial<LeadForPicker> & { row: number }): LeadForPicker {
  return {
    구분: "", 접수일: "", 대표자명: "", 업체명: "", 소개처: "", 연락처: "", 조건: "",
    ...over,
  };
}

describe("sortLeadsByRecent — 접수일 내림차순", () => {
  it("최근 접수일 먼저", () => {
    const out = sortLeadsByRecent([
      lead({ row: 1, 접수일: "2026-07-01" }),
      lead({ row: 2, 접수일: "2026-07-15" }),
      lead({ row: 3, 접수일: "2026-07-08" }),
    ]);
    expect(out.map((l) => l.row)).toEqual([2, 3, 1]);
  });
  it("접수일 동률 → row 내림차순(최근 입력 우선)", () => {
    const out = sortLeadsByRecent([
      lead({ row: 5, 접수일: "2026-07-10" }),
      lead({ row: 9, 접수일: "2026-07-10" }),
    ]);
    expect(out.map((l) => l.row)).toEqual([9, 5]);
  });
  it("빈 접수일은 뒤로", () => {
    const out = sortLeadsByRecent([
      lead({ row: 1, 접수일: "" }),
      lead({ row: 2, 접수일: "2026-07-01" }),
    ]);
    expect(out[0]!.row).toBe(2);
  });
  it("원본 배열을 mutate 하지 않음", () => {
    const src = [lead({ row: 1, 접수일: "2026-07-01" }), lead({ row: 2, 접수일: "2026-07-15" })];
    sortLeadsByRecent(src);
    expect(src.map((l) => l.row)).toEqual([1, 2]);
  });
});

describe("filterLeads — 대표자명·업체명·소개처·연락처·구분 부분일치", () => {
  const rows = [
    lead({ row: 1, 대표자명: "홍길동", 업체명: "가나상사", 소개처: "김소개", 연락처: "010-1111-2222", 구분: "소개" }),
    lead({ row: 2, 대표자명: "이순신", 업체명: "다라물산", 소개처: "", 연락처: "010-3333-4444", 구분: "콜드콜" }),
  ];
  it("빈 질의 = 전체", () => {
    expect(filterLeads(rows, "").length).toBe(2);
    expect(filterLeads(rows, "   ").length).toBe(2);
  });
  it("업체명 부분일치", () => {
    expect(filterLeads(rows, "가나").map((l) => l.row)).toEqual([1]);
  });
  it("소개처·구분·연락처로도 검색", () => {
    expect(filterLeads(rows, "김소개").map((l) => l.row)).toEqual([1]);
    expect(filterLeads(rows, "콜드콜").map((l) => l.row)).toEqual([2]);
    expect(filterLeads(rows, "3333").map((l) => l.row)).toEqual([2]);
  });
  it("공백·대소문자 무시", () => {
    expect(filterLeads(rows, " 가 나 ").map((l) => l.row)).toEqual([1]);
  });
  it("무매칭 = 빈", () => {
    expect(filterLeads(rows, "없는회사").length).toBe(0);
  });
});

describe("selectLeadsForPicker — 검색 후 접수일 정렬", () => {
  it("검색 결과를 접수일 내림차순으로", () => {
    const rows = [
      lead({ row: 1, 업체명: "가나상사", 접수일: "2026-07-01" }),
      lead({ row: 2, 업체명: "가나유통", 접수일: "2026-07-20" }),
      lead({ row: 3, 업체명: "다라", 접수일: "2026-07-25" }),
    ];
    expect(selectLeadsForPicker(rows, "가나").map((l) => l.row)).toEqual([2, 1]);
  });
});
