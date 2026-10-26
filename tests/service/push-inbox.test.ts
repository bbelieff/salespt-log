/** 비서 사서함 (belie 2026-10-26) — when a summary is due, and the notification text that opens it. */
import { describe, expect, it } from "vitest";
import { DEFAULT_PUSH_PREFERENCES } from "@/types/push";
import { reportDueSlots, reportPushMessage } from "@/service/push-inbox";

const at = (time: string, weekday = 1) => ({ date: "2026-10-26", time, weekday });

describe("reportDueSlots", () => {
  it("makes the summary even when every notification is off", () => {
    const off = { ...DEFAULT_PUSH_PREFERENCES, enabled: false, morningEnabled: false, eveningEnabled: false };
    expect(reportDueSlots(off, at("08:45"))).toEqual(["morning"]);
    expect(reportDueSlots(off, at("18:00"))).toEqual(["evening"]);
  });
  it("catches up a missed tick for three hours, then lets the slot go", () => {
    expect(reportDueSlots(DEFAULT_PUSH_PREFERENCES, at("08:30"))).toEqual([]);
    expect(reportDueSlots(DEFAULT_PUSH_PREFERENCES, at("11:30"))).toEqual(["morning"]);
    expect(reportDueSlots(DEFAULT_PUSH_PREFERENCES, at("11:45"))).toEqual([]);
  });
  it("follows the person's own times and days", () => {
    const own = { ...DEFAULT_PUSH_PREFERENCES, morningTime: "07:30", eveningTime: "20:00" };
    expect(reportDueSlots(own, at("07:30"))).toEqual(["morning"]);
    expect(reportDueSlots(own, at("18:00"))).toEqual([]);
    expect(reportDueSlots(DEFAULT_PUSH_PREFERENCES, at("08:45", 6))).toEqual([]); // 토요일, 기본은 평일만
  });
});

it("the notification is the headline split into a title and the counts, opening that summary", () => {
  const msg = reportPushMessage("morning", { id: "r1", headline: "비서의 아침 요약이 도착했어요. 컨택 3 · 미팅 2 · 실무 2 · 놓친 일 2", itemCount: 9 });
  expect(msg).toEqual({ title: "비서의 아침 요약이 도착했어요", body: "컨택 3 · 미팅 2 · 실무 2 · 놓친 일 2", url: "/inbox/r1", messageId: "report.morning.v1", itemCount: 9 });
});
