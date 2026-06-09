import { describe, it, expect } from "vitest";
import { nameMatchCandidates, nameMatches } from "@/repo/name-match";

describe("nameMatchCandidates", () => {
  it("부부 → [전체, 앞, 뒤]", () => {
    expect(nameMatchCandidates("류서하(심나영)")).toEqual([
      "류서하(심나영)",
      "류서하",
      "심나영",
    ]);
  });

  it("공백 변형 흡수", () => {
    expect(nameMatchCandidates("강구수 ( 이태평 )")).toEqual([
      "강구수 ( 이태평 )",
      "강구수",
      "이태평",
    ]);
  });

  it("비부부 → [전체] 1개", () => {
    expect(nameMatchCandidates("김지훈")).toEqual(["김지훈"]);
  });

  it("빈 문자열 → []", () => {
    expect(nameMatchCandidates("  ")).toEqual([]);
  });
});

describe("nameMatches — 부부 둘 중 하나", () => {
  it("류서하 / 심나영 / 전체 모두 매칭", () => {
    expect(nameMatches("류서하(심나영)", "류서하")).toBe(true);
    expect(nameMatches("류서하(심나영)", "심나영")).toBe(true);
    expect(nameMatches("류서하(심나영)", "류서하(심나영)")).toBe(true);
    expect(nameMatches("류서하(심나영)", " 심나영 ")).toBe(true);
  });

  it("다른 이름은 불일치", () => {
    expect(nameMatches("류서하(심나영)", "김소라")).toBe(false);
  });

  it("비부부 정확 일치 (무회귀)", () => {
    expect(nameMatches("김지훈", "김지훈")).toBe(true);
    expect(nameMatches("김지훈", "김지")).toBe(false);
    expect(nameMatches("김지훈", "")).toBe(false);
  });
});
