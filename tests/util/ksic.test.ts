/** 표준산업분류(KSIC 11차) 추천 — MSC report 의 정답 사례를 그대로 옮겨 같은 결과인지 본다(2026-11-04). */
import { describe, expect, it } from "vitest";
import { KSIC11 } from "@/config/ksic11";
import { searchKsic, suggestKsic, type KsicData } from "@/util/ksic";

const D: KsicData = KSIC11;
const top = (u: string, i: string) => suggestKsic(u, i, D)[0]?.code;

describe("suggestKsic — 업태·종목 → 세세분류", () => {
  it("분류표 1,205항목(11차)", () => {
    expect(D.items).toHaveLength(1205);
    expect(D.v).toContain("11차");
  });

  it.each([
    ["도매 및 소매업", "주유소", /^47711$/],
    ["도매", "화훼", /^4620[24]$/],
    ["농업", "화훼", /^011(22|51)$/],
    ["소매업", "꽃집", /^47851$/],
    ["서비스", "미용실", /^96112$/],
    ["숙박 및 음식점업", "커피전문점", /^56221$/],
    ["제조", "빵", /^10602$/],
    ["건설업", "실내건축공사", /^42412$/],
    ["서비스업", "경영컨설팅", /^71531$/],
  ])("%s / %s", (u, i, re) => {
    expect(top(u, i)).toMatch(re);
  });

  it("학원은 교육 서비스, '대학원'(85303)에 붙지 않는다", () => {
    expect(top("서비스업", "학원")).toMatch(/^85/);
    expect(top("서비스업", "학원")).not.toBe("85303");
  });

  it("후보는 3개까지, 비었으면 없음", () => {
    expect(suggestKsic("도매 및 소매업", "주유소", D).length).toBeLessThanOrEqual(3);
    expect(suggestKsic("", "", D)).toEqual([]);
    expect(suggestKsic("제조", "빵", null)).toEqual([]);
  });
});

describe("searchKsic — 코드·낱말로 찾기", () => {
  it("코드 앞자리와 이름", () => {
    expect(searchKsic("47711", D)[0]?.name).toBe("운송장비용 주유소 운영업");
    expect(searchKsic("", D)).toEqual([]);
  });
});
