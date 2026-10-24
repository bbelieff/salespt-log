import { describe, expect, it } from "vitest";
import { judgeBadges, type BadgeSources, type BadgeState } from "@/lib/analytics/badges";
import { BADGES, BADGE_GROUPS } from "@/lib/analytics/badge-catalog";
import { contract, meeting, slot, todo } from "../components/follow-ups-factories";

const TODAY = "2026-10-12";
const empty = (): BadgeSources => ({
  contacts: [], meetings: [], contracts: [], todos: [], leads: [], dbTabDates: [],
  firstGoalOn: null, pushOnSince: null, graduationOn: null,
});
const pick = (states: BadgeState[], id: string) => states.find(s => s.id === id)!;
const contactDays = (n: number, from = 1) =>
  Array.from({ length: n }, (_, i) => ({ leadId: `l${i}`, date: `2026-09-${String(from + i).padStart(2, "0")}`, result: "부재" }));

describe("badge catalog", () => {
  it("has the 31 approved badges, unique ids, every group known", () => {
    expect(BADGES).toHaveLength(31);
    expect(new Set(BADGES.map(b => b.id)).size).toBe(31);
    const groups = new Set(BADGE_GROUPS.map(g => g.id));
    expect(BADGES.every(b => groups.has(b.group))).toBe(true);
  });
});

describe("judgeBadges", () => {
  it("nothing recorded → nothing earned, no progress bars", () => {
    const s = judgeBadges(empty(), TODAY);
    expect(s).toHaveLength(31);
    expect(s.every(x => !x.earned && x.earnedOn === null && x.progress === null)).toBe(true);
  });

  it("activity-day badges land on the Nth sales day, and show progress until then", () => {
    const s = judgeBadges({ ...empty(), contacts: contactDays(7) }, TODAY);
    expect(pick(s, "first-activity").earnedOn).toBe("2026-09-01");
    expect(pick(s, "days-3").earnedOn).toBe("2026-09-03");
    expect(pick(s, "days-7").earnedOn).toBe("2026-09-07");
    expect(pick(s, "days-10")).toEqual({ id: "days-10", earned: false, earnedOn: null, progress: { cur: 7, max: 10, unit: "일" } });
  });

  it("future dates and 미컨택 rows never count", () => {
    const s = judgeBadges({ ...empty(), contacts: [
      { leadId: "a", date: "2026-10-20", result: "부재" },
      { leadId: "b", date: "2026-10-01", result: "미컨택" },
    ] }, TODAY);
    expect(pick(s, "first-contact").earned).toBe(false);
    expect(pick(s, "first-activity").earned).toBe(false);
  });

  it("first consult needs 컨택진행 or 상담 후 거절; 부재 is only a contact", () => {
    const s = judgeBadges({ ...empty(), contacts: [
      { leadId: "a", date: "2026-10-01", result: "부재" },
      { leadId: "a", date: "2026-10-03", result: "상담 후 거절" },
    ] }, TODAY);
    expect(pick(s, "first-contact").earnedOn).toBe("2026-10-01");
    expect(pick(s, "first-consult").earnedOn).toBe("2026-10-03");
  });

  it("meetings: booking day for first-booking, 완료/계약 meeting day for first-meeting", () => {
    const s = judgeBadges({ ...empty(), meetings: [
      meeting({ 예약일: "2026-10-01", 미팅날짜: "2026-10-05", 상태: "취소" }),
      meeting({ 예약일: "2026-10-02", 미팅날짜: "2026-10-06", 상태: "완료" }),
    ] }, TODAY);
    expect(pick(s, "first-booking").earnedOn).toBe("2026-10-01");
    expect(pick(s, "first-meeting").earnedOn).toBe("2026-10-06");
  });

  it("contracts skip carried-over ones; the 5th contract earns contracts-5; payments need an amount", () => {
    const c = (d: string, over = {}) => contract({ 계약일: d, ...over });
    const four = judgeBadges({ ...empty(), contracts: [
      c("2026-09-01", { 구분: "이월" }), c("2026-09-02"), c("2026-09-03"), c("2026-09-04"),
      c("2026-09-05", { 수납1: slot({ 수납액: 0, 수납일: "2026-09-06" }), 수납2: slot({ 수납액: 50, 수납일: "2026-09-08" }) }),
    ] }, TODAY);
    expect(pick(four, "first-contract").earnedOn).toBe("2026-09-02");
    expect(pick(four, "contracts-5").progress).toEqual({ cur: 4, max: 5, unit: "건" });
    expect(pick(four, "first-payment").earnedOn).toBe("2026-09-08");
    const five = judgeBadges({ ...empty(), contracts: ["01", "02", "03", "04", "05"].map(d => c(`2026-09-${d}`)) }, TODAY);
    expect(pick(five, "contracts-5").earnedOn).toBe("2026-09-05");
  });

  it("first todo uses the KST creation date and ignores personal schedules", () => {
    const s = judgeBadges({ ...empty(), todos: [
      todo({ type: "일반", 분류: "기타", 생성시각: "2026-09-01T01:00:00.000Z" }),
      todo({ 생성시각: "2026-09-02T16:30:00.000Z" }),
    ] }, TODAY);
    expect(pick(s, "first-todo").earnedOn).toBe("2026-09-03");
  });

  it("company info needs industry, sales and region on one lead — no date, progress shows filled count", () => {
    const partial = judgeBadges({ ...empty(), leads: [{ date: "2026-09-01", industry: "제조", sales: "", address: "서울" }] }, TODAY);
    expect(pick(partial, "first-company").progress).toEqual({ cur: 2, max: 3, unit: "칸" });
    expect(pick(partial, "first-dbsheet").earnedOn).toBe("2026-09-01");
    const full = judgeBadges({ ...empty(), leads: [{ date: "2026-09-01", industry: "제조", sales: "10억", address: "서울" }] }, TODAY);
    expect(pick(full, "first-company")).toEqual({ id: "first-company", earned: true, earnedOn: null, progress: null });
  });

  it("simple firsts come straight from their date", () => {
    const s = judgeBadges({ ...empty(), dbTabDates: ["", "2026-09-09", "2026-09-04"], firstGoalOn: "2026-09-05", pushOnSince: "2026-10-01" }, TODAY);
    expect(pick(s, "first-db").earnedOn).toBe("2026-09-04");
    expect(pick(s, "first-goal").earnedOn).toBe("2026-09-05");
    expect(pick(s, "push-on").earnedOn).toBe("2026-10-01");
  });

  it("graduation: earned only once the day has passed; alumni badges count sales days after it", () => {
    const before = judgeBadges({ ...empty(), graduationOn: "2026-10-20", contacts: contactDays(3) }, TODAY);
    expect(pick(before, "graduate").earned).toBe(false);
    expect(pick(before, "alumni-30").progress).toBeNull();
    const after = judgeBadges({ ...empty(), graduationOn: "2026-09-02", contacts: contactDays(3) }, TODAY);
    expect(pick(after, "graduate").earnedOn).toBe("2026-09-02");
    expect(pick(after, "alumni-first").earnedOn).toBe("2026-09-03");
    expect(pick(after, "alumni-30").progress).toEqual({ cur: 1, max: 30, unit: "일" });
  });

  it("grit: three absences then a consult with the same lead", () => {
    const rows = (lead: string, results: string[]) => results.map((result, i) => ({ leadId: lead, date: `2026-09-0${i + 1}`, result }));
    const yes = judgeBadges({ ...empty(), contacts: rows("a", ["부재", "부재", "부재", "컨택진행"]) }, TODAY);
    expect(pick(yes, "secret-grit").earnedOn).toBe("2026-09-04");
    const no = judgeBadges({ ...empty(), contacts: [...rows("a", ["부재", "부재", "컨택진행"]), ...rows("b", ["부재"])] }, TODAY);
    expect(pick(no, "secret-grit").earned).toBe(false);
  });

  it("full day: contact, meeting and contract on the same date", () => {
    const s = judgeBadges({ ...empty(),
      contacts: [{ leadId: "a", date: "2026-10-02", result: "재통화" }],
      meetings: [meeting({ 예약일: "2026-10-02", 미팅날짜: "2026-10-09" })],
      contracts: [contract({ 계약일: "2026-10-02" })],
    }, TODAY);
    expect(pick(s, "secret-fullday").earnedOn).toBe("2026-10-02");
  });

  it("badges whose storage does not exist yet are never earned", () => {
    const s = judgeBadges({ ...empty(), contacts: contactDays(20) }, TODAY);
    for (const id of ["week-goal-1", "week-goal-4", "home-screen", "seed-first", "ask-answer", "no-miss-week", "secret-morning"]) {
      expect(pick(s, id).earned).toBe(false);
    }
  });
});
