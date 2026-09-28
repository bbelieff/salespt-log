/**
 * 업체정보 TXT — 재구성 순서·라벨 (company-info-restructure, belie 2026-09-28).
 *  ① [대표자] → [기업정보] → [재무] (편집기와 같은 순서), 매출·기대출(사업자)은 [재무]
 *  ② 매출 라벨 연도 = 추출시각 연도 기준("매출 Y-1(2025)")
 *  ③ 임차 숫자 칸엔 단위(원·㎡), 옛 "1,000만" 은 그대로
 *  ④ 값 시작 열이 모든 줄에서 같다(화살표 라벨 포함)
 */
import { describe, expect, it } from "vitest";
import { displayWidth, formatCompanyInfoTxt } from "@/service/company-info-txt";
import { CompanyInfo } from "@/types";

const CI = CompanyInfo.parse({
  대표자이름: "홍길동",
  주민등록번호: "800101-",
  대표소유여부: "임차",
  대표임차보증금: "5,000,000",
  사업자구분: "법인",
  과세유형: "일반과세자",
  소유여부: "임차",
  임차보증금: "10,000,000",
  임차월세: "1,000만",
  임차면적: "33",
  업종주생산품목: "제조/필름",
  업태: "제조",
  주생산품목: "포장용 필름",
  금년도매출: "26' 6월 100백만",
  과년도매출: "25' 250백만",
  매출Y1상: "1.2억",
  매출증가율Y1Y: "-60.0%",
  기대출사업자: "신보 100백만",
  결산연도: "2025",
});

const txt = formatCompanyInfoTxt("예시상사", CI, "2026-09-28 10:00");
const part = (from: string, to?: string) => txt.slice(txt.indexOf(from), to ? txt.indexOf(to) : undefined);

describe("업체정보 TXT 재구성", () => {
  it("① 섹션 순서 = 대표자 → 기업정보 → 재무", () => {
    const a = txt.indexOf("[대표자]");
    const b = txt.indexOf("[기업정보]");
    const c = txt.indexOf("[재무]");
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(txt).not.toContain("[업체]");
  });

  it("① 매출·기대출(사업자)은 [재무], 업종·업태·주생산품목은 [기업정보]", () => {
    const 기업 = part("[기업정보]", "[재무]");
    const 재무 = part("[재무]");
    expect(기업).not.toContain("기대출(사업자)");
    expect(기업).not.toContain("매출");
    expect(재무).toContain("기대출(사업자)");
    expect(기업).toMatch(/● 업종 +제조\/필름/);
    expect(기업).toMatch(/● 업태 +제조/);
    expect(기업).toMatch(/● 주생산품목 +포장용 필름/);
  });

  it("② 매출 라벨 연도는 추출시각 기준", () => {
    const 재무 = part("[재무]");
    expect(재무).toMatch(/● 매출 Y\(2026\) +26' 6월 100백만/);
    expect(재무).toMatch(/● 매출 Y-1\(2025\) +25' 250백만/);
    expect(재무).toMatch(/● Y-1\(2025\) 상반기 +1\.2억/);
    expect(재무).toMatch(/● 매출증가율 Y-1→Y +-60\.0%/);
    expect(formatCompanyInfoTxt("예시상사", CI, "2027-01-02 09:00")).toContain("매출 Y-1(2026)");
  });

  it("③ 숫자만 적힌 임차 칸엔 단위, 옛 글은 그대로", () => {
    const 기업 = part("[기업정보]", "[재무]");
    expect(기업).toMatch(/● 임차 보증금 +10,000,000원/);
    expect(기업).toMatch(/● 임차 월세 +1,000만$/m);
    expect(기업).toMatch(/● 임차 면적 +33㎡/);
    expect(part("[대표자]", "[기업정보]")).toMatch(/● 임차 보증금 +5,000,000원/);
  });

  it("④ 값 시작 열이 모든 줄에서 같다", () => {
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
