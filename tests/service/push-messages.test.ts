/** web-push-notifications §3-3 — 가장 급한 1건 + 전체 건수, 업체명 보이기/숨김, 끈 종류 제외. 합성 업체. */
import { describe, expect, it } from "vitest";
import type { FollowUpItem } from "@/lib/analytics/dashboard-follow-ups";
import { buildPushMessage, withDeliveryTag } from "@/service/push-messages";
import { PUSH_CONTENT_KINDS } from "@/types/push";

const TODAY = "2026-10-23";
function make(p: Partial<FollowUpItem> & Pick<FollowUpItem, "key" | "kind" | "title">): FollowUpItem {
  return { step: "4", group: "overdue", company: p.title, detail: "", badge: "", href: "/payment?row=3", dueISO: "2026-10-20", overdueDays: 3, action: "서류 보완 요청", reasons: [], facts: [], ...p };
}
const overdue = make({ key: "todo:1", kind: "overdue", title: "가나상사" });
const lead = make({ key: "lead:1", kind: "initial", title: "다라식품", group: "today", href: "/db-sheet?lead=1", action: "첫 연락하기" });
const tomorrowTodo = make({ key: "todo:2", kind: "upcoming", title: "마바유통", group: "upcoming", dueISO: "2026-10-24", overdueDays: -1, action: "기관 신청" });
const all = { kinds: [...PUSH_CONTENT_KINDS], showCompanyNames: true };

describe("buildPushMessage — morning", () => {
  it("names the most pressing company and the total", () => {
    const m = buildPushMessage("morning", { items: [overdue, lead], urgent: [overdue, lead] }, all, TODAY)!;
    expect(m.body).toBe("가나상사 「서류 보완 요청」 하기로 한 건 연락해 보셨어요? · 전체 2건");
    expect(m).toMatchObject({ messageId: "morning.overdue.v1", url: "/payment?row=3", itemCount: 2 });
  });
  it("hides company names when the person turned them off", () => {
    const m = buildPushMessage("morning", { items: [overdue, lead], urgent: [overdue, lead] }, { ...all, showCompanyNames: false }, TODAY)!;
    expect(m.body).not.toContain("가나상사");
    expect(m.body).toBe("밀린 약속 1건이 있어요. 하나만 먼저 정리해 볼까요? · 전체 2건");
    expect(m.url).toBe("/dashboard");
  });
  it("drops kinds the person turned off, from the pick and from the count", () => {
    const m = buildPushMessage("morning", { items: [overdue, lead], urgent: [overdue, lead] }, { ...all, kinds: ["initial"] }, TODAY)!;
    expect(m.body).toBe("새 DB 다라식품에 첫 연락 해 보셨어요?");
    expect(m.itemCount).toBe(1);
  });
  it("rotates to the next variant after a recent send of the same copy", () => {
    const m = buildPushMessage("morning", { items: [overdue], urgent: [overdue] }, all, TODAY, ["morning.overdue.v1"])!;
    expect(m.messageId).toBe("morning.overdue.v2");
  });
  it("returns null with nothing to say (the dispatcher then sends nothing)", () => {
    expect(buildPushMessage("morning", { items: [tomorrowTodo], urgent: [] }, all, TODAY)).toBeNull();
  });
});

describe("buildPushMessage — evening", () => {
  it("prefers tomorrow's promise (전날 체크)", () => {
    const m = buildPushMessage("evening", { items: [overdue, tomorrowTodo], urgent: [overdue] }, all, TODAY)!;
    expect(m.body).toBe("내일 마바유통 「기관 신청」 하기로 하셨어요. 준비됐나요?");
    expect(m.messageId).toBe("evening.tomorrow.v1");
  });
  it("falls back to what is left today, or nothing", () => {
    expect(buildPushMessage("evening", { items: [overdue], urgent: [overdue] }, all, TODAY)!.messageId).toBe("evening.left.v1");
    expect(buildPushMessage("evening", { items: [], urgent: [] }, all, TODAY)).toBeNull();
  });
  it("upcoming todos follow the 「오늘 할 일」 switch", () => {
    expect(buildPushMessage("evening", { items: [tomorrowTodo], urgent: [] }, { ...all, kinds: ["overdue"] }, TODAY)).toBeNull();
  });
});

describe("withDeliveryTag", () => {
  it("appends the delivery id and refuses external URLs", () => {
    expect(withDeliveryTag("/payment?row=3", "abc")).toBe("/payment?row=3&from=push&d=abc");
    expect(withDeliveryTag("https://evil.example", "abc")).toBe("/dashboard?from=push&d=abc");
    expect(withDeliveryTag("//evil.example", "abc")).toBe("/dashboard?from=push&d=abc");
  });
});

describe("dueMeetingResults", () => {
  const m = (over: Record<string, unknown>) => ({ id: "x", 미팅날짜: TODAY, 미팅시간: "14:00", 상태: "예약", 업체명: "샘플상사", ...over }) as never;
  it("today's unrecorded meetings from three hours after start, until 21:00", async () => {
    const { dueMeetingResults } = await import("@/service/push-messages");
    expect(dueMeetingResults([m({})], TODAY, "16:45")).toEqual([]);
    expect(dueMeetingResults([m({})], TODAY, "17:00")).toHaveLength(1);
    expect(dueMeetingResults([m({ 상태: "완료" }), m({ 미팅날짜: "2026-10-22" })], TODAY, "17:00")).toEqual([]);
    expect(dueMeetingResults([m({ 미팅시간: "18:00" })], TODAY, "21:15")).toEqual([]);
  });
  it("hidden company names keep the message generic", async () => {
    const { buildMeetingResultMessage } = await import("@/service/push-messages");
    const msg = buildMeetingResultMessage(m({ id: "m9" }), false);
    expect(msg.body).not.toContain("샘플상사");
    expect(msg.url).toBe("/schedule");
  });
});
