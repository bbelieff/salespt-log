/**
 * 전광판 개인 랭킹 정렬 (arena-scoreboard-v2). rankEntries 순수함수.
 * (loadIndividualRankings 의 집계는 Sheets 의존 — 정렬/순위 로직만 박제.)
 */
import { describe, it, expect } from "vitest";
import { rankEntries } from "@/service/scoreboard";

describe("rankEntries", () => {
  it("value desc 정렬 + rank 1부터", () => {
    const r = rankEntries([
      { name: "가", cohort: "A1-1", value: 10 },
      { name: "나", cohort: "A1-2", value: 30 },
      { name: "다", cohort: "A1-3", value: 20 },
    ]);
    expect(r.map((x) => x.name)).toEqual(["나", "다", "가"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
  });
  it("동점 동순위 후 이름 asc, 다음 순위는 건너뜀", () => {
    const r = rankEntries([
      { name: "철수", cohort: "A1-1", value: 100 },
      { name: "영희", cohort: "A1-2", value: 100 },
      { name: "민수", cohort: "A1-3", value: 50 },
    ]);
    expect(r.map((x) => [x.name, x.rank])).toEqual([
      ["영희", 1],
      ["철수", 1],
      ["민수", 3],
    ]);
  });
  it("상위 10개만 반환", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      name: `n${i}`,
      cohort: "A1-1",
      value: i,
    }));
    expect(rankEntries(items)).toHaveLength(10);
  });
});
