/** 당일 미팅은 시작 3시간 뒤부터 「미팅 결과 입력」 — 아침부터 결과를 묻던 버그(belie 2026-10-25) 회귀 방지. 합성 업체. */
import { describe, expect, it } from "vitest";
import { TODAY_MEETING_REASON, buildUnresultedMeetings, meetingResultDue, nowKSTClock, summarizeFollowUps } from "@/lib/analytics/dashboard-follow-ups";
import { buildPushMessage } from "@/service/push-messages";
import { PUSH_CONTENT_KINDS } from "@/types/push";
import { TODAY, meeting } from "./follow-ups-factories";

const one = (m: ReturnType<typeof meeting>, now?: string) => buildUnresultedMeetings([m], TODAY, now)[0]!;

describe("meetingResultDue", () => {
  it("past days always ask, future days never", () => {
    expect(meetingResultDue("2026-10-11", "14:00", TODAY, "08:45")).toBe(true);
    expect(meetingResultDue("2026-10-13", "09:00", TODAY, "23:00")).toBe(false);
  });
  it("today asks only from three hours after the start", () => {
    expect(meetingResultDue(TODAY, "14:00", TODAY, "08:45")).toBe(false);
    expect(meetingResultDue(TODAY, "14:00", TODAY, "16:59")).toBe(false);
    expect(meetingResultDue(TODAY, "14:00", TODAY, "17:00")).toBe(true);
  });
  it("today without a known time or clock does not ask", () => {
    expect(meetingResultDue(TODAY, "", TODAY, "20:00")).toBe(false);
    expect(meetingResultDue(TODAY, "14:00", TODAY)).toBe(false);
  });
});

describe("today's meeting in 오늘 챙길 일", () => {
  it("morning: 「오늘 미팅」, still counted today, not a result request", () => {
    const it = one(meeting({ 미팅날짜: TODAY, 미팅시간: "14:00" }), "08:45");
    expect(it).toMatchObject({ action: "오늘 미팅", reasons: [TODAY_MEETING_REASON], group: "today" });
  });
  it("after the meeting: result input", () => {
    expect(one(meeting({ 미팅날짜: TODAY, 미팅시간: "14:00" }), "18:00")).toMatchObject({ action: "미팅 결과 입력", reasons: ["미팅 결과 미입력"] });
  });
  it("yesterday's meeting still asks for a result in the morning; tomorrow stays preparation", () => {
    expect(one(meeting({ 미팅날짜: "2026-10-11" }), "08:45").action).toBe("미팅 결과 입력");
    expect(one(meeting({ 미팅날짜: "2026-10-13" }), "08:45").action).toBe("미팅 준비");
  });
  it("summary passes the clock through", () => {
    const s = summarizeFollowUps({ meetings: [meeting({ 미팅날짜: TODAY, 미팅시간: "14:00" })] }, TODAY, "08:45");
    expect(s.items[0]!.action).toBe("오늘 미팅");
  });
  it("clock is Seoul time HH:MM", () => {
    expect(nowKSTClock(new Date("2026-10-12T23:45:00Z"))).toBe("08:45");
  });
});

describe("push copy for a meeting not yet held", () => {
  const all = { kinds: [...PUSH_CONTENT_KINDS], showCompanyNames: true };
  const todayMeeting = one(meeting({ 미팅날짜: TODAY, 미팅시간: "14:00", 업체명: "샘플 가람식당" }), "08:45");
  it("morning names the meeting without asking for its result", () => {
    const m = buildPushMessage("morning", { items: [todayMeeting], urgent: [todayMeeting] }, all, TODAY)!;
    expect(m.body).toBe("오늘 샘플 가람식당 미팅이 있어요. 끝나면 결과를 적어 두세요.");
    const v2 = buildPushMessage("morning", { items: [todayMeeting], urgent: [todayMeeting] }, all, TODAY, ["morning.meeting.v1"])!;
    expect(v2.body).not.toContain("결과를 남겨");
    const hidden = buildPushMessage("morning", { items: [todayMeeting], urgent: [todayMeeting] }, { ...all, showCompanyNames: false }, TODAY)!;
    expect(hidden.body).not.toContain("비어 있어요");
  });
  it("evening with a meeting not yet past three hours does not list 「오늘 미팅」 as a task to wrap up", () => {
    const late = one(meeting({ 미팅날짜: TODAY, 미팅시간: "19:00", 업체명: "샘플 가람식당" }), "18:00");
    const m = buildPushMessage("evening", { items: [late], urgent: [late] }, all, TODAY)!;
    expect(m.body).toBe("오늘 샘플 가람식당 미팅, 끝나면 결과를 적어 두세요.");
    const earlier = one(meeting({ 미팅날짜: TODAY, 미팅시간: "16:00", 업체명: "샘플 가람식당" }), "18:00");
    expect(earlier.action).toBe("오늘 미팅");
  });
});
