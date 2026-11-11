/** 주간 보드 계산 — 보이는 첫날, 제목, 겹침 칸, 투두 묶음, 결과 입력 대기. */
import { describe, expect, it } from "vitest";
import { groupTimedTodos, hourPct, layoutLanes, monthWeekLabel, needsResult, viewStartOf } from "@/app/(app)/schedule/_lib/board";
import type { Meeting, Todo } from "@/types";

const todo = (id: string, t: string) => ({ id, 예정시각: t } as Todo);

describe("주간 보드 계산", () => {
  it("월~일 보기는 수강 주(금) 안의 월요일부터", () => {
    expect(viewStartOf("2026-11-06", "fri")).toBe("2026-11-06");
    expect(viewStartOf("2026-11-06", "mon")).toBe("2026-11-09");
  });

  it("제목은 가운데 날의 달·주", () => {
    expect(monthWeekLabel("2026-11-06")).toBe("11월 2주");
    expect(monthWeekLabel("2026-10-30")).toBe("11월 1주");
  });

  it("세로 위치는 07~22시 안으로", () => {
    expect(hourPct(7)).toBe(0);
    expect(hourPct(22)).toBe(100);
    expect(hourPct(5)).toBe(0);
    expect(hourPct(23.5)).toBe(100);
  });

  it("겹치는 것만 나란히, 안 겹치면 한 칸", () => {
    const placed = layoutLanes([{ item: "a", start: 9, end: 10 }, { item: "b", start: 9.5, end: 10.5 }, { item: "c", start: 11, end: 12 }]);
    const by = Object.fromEntries(placed.map((p) => [p.item, p]));
    expect([by.a!.lanes, by.b!.lanes, by.c!.lanes]).toEqual([2, 2, 1]);
    expect(by.a!.lane).not.toBe(by.b!.lane);
  });

  it("겹치는 투두는 한 묶음으로 쌓인다", () => {
    const groups = groupTimedTodos([todo("x", "09:00"), todo("y", "09:30"), todo("z", "14:00")]);
    expect(groups.map((g) => g.todos.map((t) => t.id))).toEqual([["x", "y"], ["z"]]);
  });

  it("끝난 지 지난 예약 미팅만 결과 입력 대기", () => {
    const m = { 상태: "예약", 미팅날짜: "2026-11-10", 미팅시간: "09:00" } as Meeting;
    expect(needsResult(m, new Date(2026, 10, 10, 9, 30))).toBe(false);
    expect(needsResult(m, new Date(2026, 10, 10, 10, 30))).toBe(true);
    expect(needsResult({ ...m, 상태: "완료" }, new Date(2026, 10, 11))).toBe(false);
  });
});
