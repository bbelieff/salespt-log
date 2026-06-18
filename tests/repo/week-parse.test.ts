/**
 * parseWeekRows — 날짜(C열) 병합 forward-fill (readweek-merged-date-rows 2026-06-18).
 * 하루 첫 행(매입DB)에만 날짜, 나머지 채널 행은 병합 빈칸 → 직전 날짜 상속.
 */
import { describe, it, expect } from "vitest";
import { parseWeekRows } from "@/repo/week-parse";

// 테스트용 날짜 변환: ISO 문자열은 그대로, 그 외 null.
const toISO = (v: string | number | boolean): string | null =>
  typeof v === "string" && v ? v : null;
const run = (data: unknown[][]) =>
  parseWeekRows(data as (string | number | boolean)[][], toISO);

describe("parseWeekRows — 병합 날짜 forward-fill", () => {
  it("첫 행에만 날짜, 나머지 채널 빈칸 → 4채널 전부 같은 날짜로 파싱", () => {
    const rows = run([
      ["2026-06-12", "매입DB", 10, 0, 0, 0],
      [undefined, "직접생산", 20, 0, 0, 0],
      ["", "현수막", 60, 0, 0, 0],
      [undefined, "콜·지·기·소", 5, 0, 0, 0],
    ]);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.date === "2026-06-12")).toBe(true);
    expect(rows.find((r) => r.channel === "현수막")!.production).toBe(60);
    expect(rows.find((r) => r.channel === "콜·지·기·소")!.production).toBe(5);
  });

  it("다음 날 첫 행에서 날짜 갱신 → 그 날 채널들이 새 날짜 상속", () => {
    const rows = run([
      ["2026-06-12", "매입DB", 10, 0, 0, 0],
      [undefined, "현수막", 60, 0, 0, 0],
      ["2026-06-13", "매입DB", 0, 0, 0, 0],
      [undefined, "현수막", 20, 0, 0, 0],
    ]);
    expect(rows.find((r) => r.date === "2026-06-12" && r.channel === "현수막")!.production).toBe(60);
    expect(rows.find((r) => r.date === "2026-06-13" && r.channel === "현수막")!.production).toBe(20);
  });

  it("#VALUE! 셀은 0(numCell), 행은 보존", () => {
    const rows = run([["2026-06-12", "현수막", "#VALUE!", 5, 0, 0]]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.production).toBe(0);
    expect(rows[0]!.inflow).toBe(5);
  });

  it("채널 빈 행 스킵 + 첫 날짜 이전 행 스킵", () => {
    const rows = run([
      [undefined, "", 0, 0, 0, 0], // 채널 없음 → 스킵
      [undefined, "현수막", 5, 0, 0, 0], // 아직 날짜 없음 → 스킵
      ["2026-06-12", "매입DB", 10, 0, 0, 0],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.channel).toBe("매입DB");
  });
});
