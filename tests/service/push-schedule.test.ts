/** web-push-notifications §3-2·§3-5 — 15분 눈금, 요일, 다음 알림 미리보기. 합성 시각. */
import { describe, expect, it } from "vitest";
import { DEFAULT_PUSH_PREFERENCES, type PushPreferences } from "@/types/push";
import { dueSlots, kstNow, nextNotification, weekdayBit } from "@/service/push-schedule";

const prefs = (p: Partial<PushPreferences> = {}): PushPreferences => ({ ...DEFAULT_PUSH_PREFERENCES, ...p });
// 2026-10-23 is a Friday. 23:47 UTC on Thu = 08:47 KST Fri.
const fri0847 = new Date("2026-10-22T23:47:30Z");

describe("kstNow", () => {
  it("uses Seoul wall time and floors to the 15-minute cron grid", () => {
    expect(kstNow(fri0847)).toEqual({ date: "2026-10-23", weekday: 5, time: "08:45" });
  });
});

describe("dueSlots", () => {
  const tick = { date: "2026-10-23", weekday: 5, time: "08:45" };
  it("fires the default morning slot at 08:45 on a weekday", () => {
    expect(dueSlots(prefs(), tick)).toEqual(["morning"]);
  });
  it("respects the master switch, the slot switch and the weekday bits", () => {
    expect(dueSlots(prefs({ enabled: false }), tick)).toEqual([]);
    expect(dueSlots(prefs({ morningEnabled: false }), tick)).toEqual([]);
    expect(dueSlots(prefs(), { ...tick, weekday: 6 })).toEqual([]); // weekdays only → Saturday off
    expect(dueSlots(prefs({ weekdays: 127 }), { ...tick, weekday: 6 })).toEqual(["morning"]);
  });
  it("fires evening only at its own time", () => {
    expect(dueSlots(prefs(), { ...tick, time: "18:00" })).toEqual(["evening"]);
    expect(dueSlots(prefs(), { ...tick, time: "18:15" })).toEqual([]);
  });
});

describe("nextNotification", () => {
  it("picks evening later today, then next weekday morning, skipping the weekend", () => {
    expect(nextNotification(prefs(), { date: "2026-10-23", weekday: 5, time: "09:00" })).toMatchObject({ slot: "evening", daysAhead: 0, time: "18:00" });
    expect(nextNotification(prefs(), { date: "2026-10-23", weekday: 5, time: "18:00" })).toMatchObject({ slot: "morning", daysAhead: 3, weekday: 1, time: "08:45" });
  });
  it("returns null when everything is off", () => {
    expect(nextNotification(prefs({ morningEnabled: false, eveningEnabled: false }), { date: "2026-10-23", weekday: 5, time: "09:00" })).toBeNull();
    expect(nextNotification(prefs({ enabled: false }), { date: "2026-10-23", weekday: 5, time: "09:00" })).toBeNull();
  });
  it("weekday bit for Sunday is 64", () => { expect(weekdayBit(7)).toBe(64); });
});
