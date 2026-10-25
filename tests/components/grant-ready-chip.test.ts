/** 「공고매칭 n/3」 펼침 줄(2026-10-26) — 조건마다 ✓/–, 빈 조건은 채울 칸. 값은 모두 가상. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { grantReadyLines } from "@/components/company-info/GrantReadyChip";

describe("grantReadyLines", () => {
  it("다 차면 ✓ 세 줄, 채울 칸 없음", () => {
    const l = grantReadyLines({ 소재지: "울산광역시 남구 삼산로 1", 업태: "제조", 사대보험직원: "4명" } as never);
    expect(l.map((x) => x.text)).toEqual(["지역 울산 남구", "대분류 제조업", "규모 소상공인"]);
    expect(l.every((x) => x.ok && !x.fill)).toBe(true);
  });
  it("빈 조건은 그 칸으로 데려간다", () => {
    const l = grantReadyLines({} as never);
    expect(l.map((x) => x.fill)).toEqual(["소재지", "업태", "사대보험직원"]);
    expect(l[2]!.text).toBe("규모: 4대보험 직원 칸이 비어 있어요");
  });
  it("직원 수는 있는데 대분류가 없으면 규모는 업태로", () => {
    const l = grantReadyLines({ 사대보험직원: "3명" } as never);
    expect(l[2]).toMatchObject({ ok: false, fill: "업태" });
  });
  it("못 읽은 소재지는 따로 알린다", () => {
    expect(grantReadyLines({ 소재지: "중구 을지로 1" } as never)[0]!.text).toBe("지역: 소재지에서 시·도를 못 읽었어요");
  });
  it("칩은 접기 버튼 밖(버튼 안 버튼 금지) · Esc·바깥 누르기로 닫힘", () => {
    const header = readFileSync("components/company-info/CompanyInfoHeader.tsx", "utf8");
    expect(header.indexOf("{badge &&")).toBeGreaterThan(header.indexOf("</button>"));
    const chip = readFileSync("components/company-info/GrantReadyChip.tsx", "utf8");
    expect(chip).toContain('"Escape"');
    expect(chip).toContain('"pointerdown"');
  });
});
