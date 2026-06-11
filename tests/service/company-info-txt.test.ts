/**
 * 업체정보 TXT 정렬형 포맷 (consultation-log §3-3, 2026-06-11 확정).
 * 핵심 검증: EAW 공백 패딩으로 값 시작 열 통일(탭 금지), 멀티라인 "- " 목록
 * + 들여쓰기 세로 정렬, 빈 필드 줄 생략, 커스텀 그룹 끝 포함.
 */
import { describe, it, expect } from "vitest";
import {
  displayWidth,
  formatCompanyInfoTxt,
  companyInfoTxtFileName,
} from "@/service/company-info-txt";
import { CompanyInfo } from "@/types";

/** "● 라벨 + 패딩 + 값" 줄에서 값 시작 표시열(EAW). 매칭 실패 시 -1. */
function valueStartCol(line: string): number {
  const m = line.match(/^(● .*?)( {2,})(?=\S)/);
  if (!m) return -1;
  return displayWidth(m[1]!) + m[2]!.length;
}

describe("displayWidth (EAW)", () => {
  it("한글=2칸, 영문/숫자=1칸", () => {
    expect(displayWidth("가나")).toBe(4);
    expect(displayWidth("ab1")).toBe(3);
    expect(displayWidth("신용점수(KCB/NCB)")).toBe(17);
  });
});

describe("업체정보 TXT 포맷 (정렬형)", () => {
  it("파일명 = 업체정보_{업체명}.txt (trim)", () => {
    expect(companyInfoTxtFileName(" A업체 ")).toBe("업체정보_A업체.txt");
  });

  it("값 시작 열이 모든 줄에서 동일 (한글·영문 라벨 혼합, 탭 없음)", () => {
    const ci = CompanyInfo.parse({
      개업일: "25.01.24",
      사업자등록번호: "000-00-0000",
      신용점수: "919/855",
      대표자이름: "김대표",
      대표자생년월일: "88.01.24",
      과년도매출Y2: "24' 148백만",
    });
    const txt = formatCompanyInfoTxt("A업체", ci, "2026-06-11 14:00");
    expect(txt).not.toContain("\t"); // 탭 금지
    const lines = txt.split("\n").filter((l) => l.startsWith("● "));
    expect(lines.length).toBeGreaterThanOrEqual(8); // 업체명+추출시각+6필드
    const cols = lines.map(valueStartCol);
    expect(cols.every((c) => c > 0)).toBe(true);
    expect(new Set(cols).size).toBe(1); // 전부 같은 열
    expect(txt).toContain("세일즈PT 업체정보");
    expect(txt).toContain("과년도 매출 Y-2");
    expect(txt).toContain("신용점수(KCB/NCB)");
  });

  it("멀티라인(기대출) → '- ' 목록 + 둘째 줄 들여쓰기 세로 정렬", () => {
    const ci = CompanyInfo.parse({
      기대출사업자: "신보 100백만\n재단 50백만\n중진공 150백만",
    });
    const txt = formatCompanyInfoTxt("B업체", ci, "T");
    const lines = txt.split("\n");
    const head = lines.find((l) => l.includes("기대출(사업자)"))!;
    expect(head).toMatch(/- 신보 100백만$/);
    const cont = lines.filter((l) => /^ +- /.test(l));
    expect(cont).toHaveLength(2);
    // 들여쓰기 폭(공백 수) == 헤드 줄 값("- ") 시작 열
    const headCol = valueStartCol(head);
    for (const l of cont) expect(l.match(/^ +/)![0].length).toBe(headCol);
  });

  it("빈 필드 줄 생략 + 커스텀은 그룹 끝 포함", () => {
    const ci = CompanyInfo.parse({
      개업일: "25.01.24",
      커스텀: { 업체: { 비고: "VIP" }, 대표자: {} },
    });
    const txt = formatCompanyInfoTxt("C업체", ci, "T");
    expect(txt).not.toContain("사업자구분"); // 빈 필드 생략
    expect(txt).toContain("비고");
    expect(txt).toContain("VIP");
    expect(txt).toContain("[대표자]"); // 섹션 헤더는 유지
  });
});
