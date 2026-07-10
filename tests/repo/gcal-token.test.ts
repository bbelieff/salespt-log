/** gcal 연동 설정 파싱 — 기본값·손상복구·옛 토글키 strip (2026-07-09 유형 토글 폐기). */
import { describe, expect, it } from "vitest";
import { parseGcalSettings } from "@/repo/gcal-token";

describe("parseGcalSettings", () => {
  it("빈 문자열 → 기본(primary)", () => {
    expect(parseGcalSettings("")).toEqual({ calendarId: "primary" });
    expect(parseGcalSettings("   ")).toEqual({ calendarId: "primary" });
  });

  it("정상 JSON → calendarId 유지", () => {
    expect(parseGcalSettings(JSON.stringify({ calendarId: "work@group.calendar.google.com" }))).toEqual({
      calendarId: "work@group.calendar.google.com",
    });
  });

  it("옛 저장본(meeting/todo/general 포함) → 토글키 제거, calendarId만 남김", () => {
    const legacy = JSON.stringify({ calendarId: "primary", meeting: true, todo: false, general: true });
    expect(parseGcalSettings(legacy)).toEqual({ calendarId: "primary" });
  });

  it("calendarId 누락 → 기본 primary 보충", () => {
    expect(parseGcalSettings(JSON.stringify({ meeting: false }))).toEqual({ calendarId: "primary" });
  });

  it("손상 JSON → 기본으로 복구(throw 없음)", () => {
    expect(parseGcalSettings("{not json")).toEqual({ calendarId: "primary" });
    expect(parseGcalSettings("null")).toEqual({ calendarId: "primary" });
  });
});
