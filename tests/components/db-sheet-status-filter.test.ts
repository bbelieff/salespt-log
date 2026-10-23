import { describe, expect, it } from "vitest";
import {
  STATUS_FILTERS,
  filterDbSheetRows,
  hasStatusRestriction,
  toggleStatusFilter,
  type StatusFilterId,
} from "@/app/(app)/db-sheet/_components/status-filter";

type FixtureRow = {
  id: string;
  company: string;
  owner: string;
  phone: string;
  supplier: string;
  date: string;
  result: string;
};

const fixtureResults = [
  ["uncontacted", "미컨택"],
  ["absent", "부재"],
  ["simple-refusal", "단순거절"],
  ["recall", "재통화"],
  ["progress", "컨택진행"],
  ["post-consult-refusal", "상담 후 거절"],
  ["as-planned", "AS예정"],
  ["unknown", "새 결과"],
] as const;
const rows: FixtureRow[] = fixtureResults.map(([id, result], index) => ({
  id,
  result,
  company: index === 4 ? "선택 회사" : `합성 회사 ${index}`,
  owner: "김가상",
  phone: `010-0000-000${index}`,
  supplier: index === 4 ? "선택 공급처" : "기본 공급처",
  date: index === 4 ? "2026-10-16" : "2026-10-15",
}));

const filterIds = STATUS_FILTERS.map(filter => filter.id);
const expectedResultByFilter: Record<StatusFilterId, string[]> = {
  uncontacted: ["미컨택"],
  absent: ["부재"],
  "simple-refusal": ["단순거절"],
  recall: ["재통화"],
  progress: ["컨택진행", "상담 후 거절"],
  "as-planned": ["AS예정"],
  "long-term": [],
};

describe("DB관리시트 상태 보기 필터", () => {
  it("공급처 다중 선택을 합집합으로, 날짜/검색/상태와 교집합으로 계산한다", () => {
    expect(filterDbSheetRows(rows, { selectedStatuses: [], selectedSuppliers: ["기본 공급처", "선택 공급처"] })).toEqual(rows);
    expect(filterDbSheetRows(rows, { selectedStatuses: ["progress"], selectedSuppliers: ["선택 공급처"], search: "선택", from: "2026-10-16", to: "2026-10-16" })).toEqual([rows[4]]);
    expect(filterDbSheetRows(rows, { selectedStatuses: [], selectedSuppliers: ["없는 공급처"] })).toEqual([]);
    expect(filterDbSheetRows(rows, { selectedStatuses: [], selectedSuppliers: [] })).toEqual(rows);
  });
  it.each(Array.from({ length: 2 ** filterIds.length }, (_, mask) => mask))(
    "상태 칩 조합 %i를 OR 필터로 계산한다",
    mask => {
      const selected = filterIds.filter((_, index) => mask & (1 << index));
      const actual = filterDbSheetRows(rows, { selectedStatuses: selected });
      const unrestricted = selected.length === 0 || selected.length === filterIds.length;
      const accepted = new Set(selected.flatMap(id => expectedResultByFilter[id]));
      const expected = unrestricted ? rows : rows.filter(row => accepted.has(row.result));

      expect(actual.map(row => row.id)).toEqual(expected.map(row => row.id));
      expect(new Set(actual.map(row => row.id)).size).toBe(actual.length);
      expect(hasStatusRestriction(selected)).toBe(!unrestricted);
      expect(actual.every(row => rows.includes(row))).toBe(true);
    },
  );

  it("unknown 결과는 0개·전체 선택에서만 전체 보기의 일부로 유지한다", () => {
    expect(filterDbSheetRows(rows, { selectedStatuses: [] }).at(-1)?.id).toBe("unknown");
    expect(filterDbSheetRows(rows, { selectedStatuses: filterIds }).at(-1)?.id).toBe("unknown");
    expect(filterDbSheetRows(rows, { selectedStatuses: ["progress"] }).some(row => row.id === "unknown")).toBe(false);
  });

  it("검색·공급처·날짜를 상태 OR 결과와 AND하고 원본 순서와 객체를 보존한다", () => {
    const original = structuredClone(rows);
    const actual = filterDbSheetRows(rows, {
      selectedStatuses: ["progress"],
      search: "선택",
      supplier: "선택 공급처",
      from: "2026-10-16",
      to: "2026-10-16",
    });

    expect(actual).toEqual([rows[4]]);
    expect(actual[0]).toBe(rows[4]);
    expect(rows).toEqual(original);
  });

  it("칩을 독립적으로 켜고 끄며 빈 배열로 reset할 수 있다", () => {
    let selected: StatusFilterId[] = [];
    selected = toggleStatusFilter(selected, "absent");
    selected = toggleStatusFilter(selected, "progress");
    expect(selected).toEqual(["absent", "progress"]);
    expect(toggleStatusFilter(selected, "absent")).toEqual(["progress"]);
    expect(filterDbSheetRows(rows, { selectedStatuses: [] })).toEqual(rows);
  });
});
