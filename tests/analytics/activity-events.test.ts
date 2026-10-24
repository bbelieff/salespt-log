import { describe, expect, it } from "vitest";
import { activityDays, cumulativeSalesDays } from "@/lib/analytics/activity-days";
import { toActivityEvents } from "@/lib/analytics/activity-events";
import { contract, meeting, todo } from "../components/follow-ups-factories";

const TODAY = "2026-10-12";

describe("toActivityEvents", () => {
  it("contacts keep their contact date and result; the day judgement stays in activity-days", () => {
    const events = toActivityEvents({ contacts: [{ date: "2026-10-05", result: "부재" }, { date: "2026-10-06", result: "미컨택" }] });
    expect(events).toEqual([{ kind: "contact", date: "2026-10-05", result: "부재" }, { kind: "contact", date: "2026-10-06", result: "미컨택" }]);
    expect([...activityDays(events, TODAY).keys()]).toEqual(["2026-10-05"]);
  });
  it("a meeting counts on the booking day and, when completed, on the meeting day — not on the save day", () => {
    const days = activityDays(toActivityEvents({ meetings: [meeting({ 예약일: "2026-10-01", 미팅날짜: "2026-10-08", 상태: "완료" })] }), TODAY);
    expect([...days.entries()]).toEqual([["2026-10-01", "sales"], ["2026-10-08", "sales"]]);
  });
  it("a later cancellation does not erase the booking day; it adds no meeting day", () => {
    const days = activityDays(toActivityEvents({ meetings: [meeting({ 예약일: "2026-10-01", 미팅날짜: "2026-10-08", 상태: "취소" })] }), TODAY);
    expect([...days.keys()]).toEqual(["2026-10-01"]);
  });
  it("contracts count on the contract date; empty dates are skipped", () => {
    const events = toActivityEvents({ contracts: [contract({ 계약일: "2026-10-02" }), contract({ 계약일: "" })] });
    expect(events).toEqual([{ kind: "contract", date: "2026-10-02" }]);
  });
  it("only 'history' work records count; open or completed to-dos have no completion date and are skipped", () => {
    const events = toActivityEvents({ todos: [
      todo({ 기록종류: "history", 예정일자: "2026-10-03" }),
      todo({ 기록종류: "todo", 완료여부: true, 예정일자: "2026-10-04" }),
      todo({ 기록종류: "todo", 완료여부: false, 예정일자: "2026-10-05" }),
    ] });
    expect(events).toEqual([{ kind: "todoDone", date: "2026-10-03" }]);
  });
  it("personal schedule history (type 일반 · 분류 기타) is not a sales action; customer events still count", () => {
    const events = toActivityEvents({ todos: [
      todo({ 기록종류: "history", type: "일반", 분류: "기타", 예정일자: "2026-10-03" }),
      todo({ 기록종류: "history", type: "일반", 분류: "기존", 예정일자: "2026-10-04" }),
    ] });
    expect(events).toEqual([{ kind: "todoDone", date: "2026-10-04" }]);
  });
  it("daily metric rows are not a source: blank pre-filled rows and explicit zeros look the same", () => {
    const days = activityDays(toActivityEvents({ contacts: [], meetings: [], contracts: [], todos: [] }), TODAY);
    expect(days.size).toBe(0);
    expect(cumulativeSalesDays(days)).toBe(0);
  });
  it("back-filled records land on their own past dates, never on today", () => {
    const days = activityDays(toActivityEvents({ contacts: [{ date: "2026-09-30", result: "재통화" }] }), TODAY);
    expect(days.has(TODAY)).toBe(false);
    expect(days.get("2026-09-30")).toBe("sales");
  });
});
