/**
 * 업체정보 TXT — 백만원·연도별 매출·기준 연도·배치 (company-finance-won-grid, belie 2026-09-28). 합성 값만.
 *  ① 금액 칸 = "250.1백만원 (약 2.5억)", 옛 자유 글은 그대로
 *  ② 매출 라벨 = 업체의 매출 기준 연도(없으면 추출시각 연도), 줄 순서 상반기 · 하반기 · 합계
 *  ③ [기업정보] 업종 줄은 등록번호 뒤, 4대보험 직원은 소유여부 뒤
 *  ④ [대표자] 주민등록번호가 있으면 생년월일 줄 없음, 비었으면 생년월일
 *  ⑤ 기준 연도만 있는 [재무] 는 쓰지 않는다 · 값 시작 열 정렬
 */
import { describe, expect, it } from "vitest";
import { displayWidth, formatCompanyInfoTxt } from "@/service/company-info-txt";
import { CompanyInfo } from "@/types";

const at = "2026-09-28 10:00";
const txtOf = (v: Partial<CompanyInfo>) => formatCompanyInfoTxt("예시상사", CompanyInfo.parse(v), at);
const lineOf = (txt: string, label: string) => txt.split("\n").find((l) => l.startsWith(`● ${label} `)) ?? "";

describe("① 금액 = 백만원 + 약", () => {
  it("숫자 금액은 '백만원 (약 …)', 옛 글은 그대로", () => {
    const txt = txtOf({ 영업이익: "250.1", 자본총계: "-3.2", 자산총계: "1234", 이자비용: "0", 부채총계: "3,200만" });
    expect(lineOf(txt, "영업이익")).toMatch(/250\.1백만원 \(약 2\.5억\)$/);
    expect(lineOf(txt, "자본총계")).toMatch(/-3\.2백만원 \(약 -320만\)$/);
    expect(lineOf(txt, "자산총계")).toMatch(/1,234백만원 \(약 12\.3억\)$/);
    expect(lineOf(txt, "이자비용")).toMatch(/ 0백만원$/);
    expect(lineOf(txt, "부채총계")).toMatch(/ 3,200만$/);
  });
});

describe("② 매출 라벨·순서", () => {
  it("저장된 기준 연도로 라벨, 줄마다 상반기 · 하반기 · 합계", () => {
    const txt = txtOf({ 매출기준연도: "2025", 매출Y상: "120", 매출Y하: "130", 금년도매출: "250" });
    expect(lineOf(txt, "매출 기준 연도")).toMatch(/2025$/);
    const a = txt.indexOf("● Y(2025) 상반기");
    const b = txt.indexOf("● Y(2025) 하반기");
    const c = txt.indexOf("● 매출 Y(2025)");
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(lineOf(txt, "매출 Y(2025)")).toMatch(/250백만원 \(약 2\.5억\)$/);
  });

  it("기준 연도가 없으면 추출시각 연도", () => {
    expect(txtOf({ 과년도매출: "250" })).toContain("● 매출 Y-1(2025)");
  });
});

describe("③ [기업정보] 순서", () => {
  it("사업자등록번호 → 업종·업태·주생산품목 → 소재지 → 소유여부 → 4대보험 직원 → 특허", () => {
    const txt = txtOf({
      사업자등록번호: "000-00-00000",
      업종주생산품목: "제조",
      업태: "제조",
      주생산품목: "필름",
      소재지: "서울",
      소유여부: "자가",
      사대보험직원: "3명",
      특허및인증: "벤처",
    });
    const order = ["사업자등록번호", "업종", "주생산품목", "소재지", "소유여부", "4대보험 직원", "특허 및 인증"].map((l) =>
      txt.indexOf(`● ${l} `),
    );
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });
});

describe("④ [대표자] 주민등록번호 / 생년월일", () => {
  it("주민등록번호가 있으면 생년월일 줄을 쓰지 않는다", () => {
    const txt = txtOf({ 대표자이름: "홍길동", 주민등록번호: "880124-", 대표자생년월일: "88.01.24", 신용점수: "900" });
    expect(txt).not.toContain("● 생년월일");
    expect(txt.indexOf("● 이름")).toBeLessThan(txt.indexOf("● 주민등록번호"));
    expect(txt.indexOf("● 주민등록번호")).toBeLessThan(txt.indexOf("● 신용점수"));
  });
  it("주민등록번호가 비었고 생년월일이 있으면 생년월일 줄", () => {
    const txt = txtOf({ 대표자이름: "홍길동", 대표자생년월일: "88.01.24" });
    expect(lineOf(txt, "생년월일")).toMatch(/88\.01\.24$/);
    expect(txt).not.toContain("● 주민등록번호");
  });
});

describe("⑤ 빈 [재무] · 정렬", () => {
  it("기준 연도만 있으면 [재무] 를 쓰지 않는다", () => {
    expect(txtOf({ 대표자이름: "홍길동", 매출기준연도: "2026" })).not.toContain("[재무]");
  });
  it("값 시작 열이 모든 줄에서 같다", () => {
    const txt = txtOf({ 매출기준연도: "2026", 매출Y상: "120", 영업이익: "-3.2", 대표자이름: "홍길동" });
    const cols = txt
      .split("\n")
      .filter((l) => l.startsWith("● "))
      .map((l) => {
        const m = l.match(/^(● .*?)( {2,})(?=\S)/)!;
        return displayWidth(m[1]!) + m[2]!.length;
      });
    expect(new Set(cols).size).toBe(1);
  });
});
