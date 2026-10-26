/** 비서의 하루요약 (belie 2026-10-26) — 구역 나누기·중복 없음·문구. 합성 업체. */
import { describe, expect, it } from "vitest";
import type { FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
import type { Meeting } from "@/types";
import { buildDailyReport, isEmptyReport } from "@/service/push-report";

const TODAY = "2026-10-27";
const item = (p: Partial<FollowUpItem> & Pick<FollowUpItem, "key" | "kind" | "company">): FollowUpItem => ({
  step: "2", group: "today", title: p.company, detail: "", badge: "오늘", href: "/x", dueISO: TODAY, overdueDays: 0, action: "다시 연락하기", reasons: [], facts: [], ...p,
});
const initial = item({ key: "lead:a", kind: "initial", company: "새봄유통", action: "첫 연락하기" });
const absent = item({ key: "lead:b", kind: "recontact", company: "가온식품", facts: [{ label: "연락 결과", value: "부재" }] });
const todo = item({ key: "todo:t1", kind: "today", step: "4", company: "한빛상사", action: "서류 제출" });
const late = item({ key: "todo:t2", kind: "overdue", step: "4", group: "overdue", company: "누리상사", action: "기관 신청", badge: "D+03", dueISO: "2026-10-24", overdueDays: 3 });
const meetingRow = item({ key: "meeting:m1", kind: "meeting", step: "3", company: "바른상회", action: "미팅 준비" });
const tomorrowTodo = item({ key: "todo:t3", kind: "upcoming", step: "4", group: "upcoming", company: "정우건설", action: "기관 신청", dueISO: "2026-10-28", badge: "D-01" });
const meeting = (id: string, date: string, time: string, company: string) => ({ id, 미팅날짜: date, 미팅시간: time, 업체명: company, 장소: "강남", 상태: "예약" }) as unknown as Meeting;
const summary = { items: [initial, absent, todo, late, meetingRow, tomorrowTodo], urgent: [initial, absent, todo, late, meetingRow] };
const meetings = [meeting("m1", TODAY, "16:30", "바른상회"), meeting("m0", TODAY, "14:00", "한빛상사"), meeting("m2", "2026-10-28", "10:00", "다온물산")];

describe("morning report", () => {
  const r = buildDailyReport("morning", summary, meetings, TODAY, "08:45");
  const sec = (k: string) => r.sections.find(s => s.key === k)!.items;
  it("splits contact, meeting, work and missed with no item twice", () => {
    expect(sec("contact").map(i => [i.tag, i.detail])).toEqual([["미컨택", "첫 연락하기"], ["부재", "다시 연락하기"]]);
    expect(sec("meeting").map(i => i.label)).toEqual(["한빛상사", "바른상회"]); // time order
    expect(sec("work").map(i => i.label)).toEqual(["한빛상사"]);
    expect(sec("missed").map(i => [i.label, i.overdueDays])).toEqual([["누리상사", 3]]); // today's meeting row is not repeated
    expect(sec("meeting").map(i => i.time)).toEqual(["14:00", "16:30"]);
  });
  it("headline carries the four counts", () => {
    expect(r.headline).toBe("비서의 아침 요약이 도착했어요. 컨택 2 · 미팅 2 · 실무 1 · 놓친 일 1");
  });
});

describe("evening report", () => {
  const r = buildDailyReport("evening", summary, meetings, TODAY, "18:00");
  const sec = (k: string) => r.sections.find(s => s.key === k)!.items;
  it("shows what is left today, tomorrow's appointments and missed", () => {
    expect(sec("left").map(i => i.label)).toEqual(["새봄유통", "가온식품", "한빛상사"]);
    expect(sec("tomorrow").map(i => i.label)).toEqual(["다온물산", "정우건설"]);
    expect(sec("missed").map(i => i.label)).toEqual(["누리상사"]);
    expect(r.headline).toBe("비서의 저녁 요약이 도착했어요. 남은 일 3 · 내일 약속 2 · 놓친 일 1");
  });
});

it("an empty day is empty (the morning then uses 오늘의 씨앗)", () => {
  expect(isEmptyReport(buildDailyReport("morning", { items: [], urgent: [] }, [], TODAY, "08:45"))).toBe(true);
});
