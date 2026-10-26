/**
 * 비서의 하루요약 (belie 2026-10-26) — pure. Morning: 영업(컨택·미팅) · 실무 · 놓친 일.
 * Evening: 오늘 남은 일 · 내일 약속 · 놓친 일. Every list comes from the same 「오늘 챙길 일」 summary the
 * dashboard shows; an item appears in one section only, and 놓친 일 holds what is overdue or left over.
 */
import type { FollowUpItem, FollowUpSummary } from "@/lib/analytics/dashboard-follow-ups";
import type { Meeting } from "@/types";
import type { DailyReport, ReportItem, ReportSection, ReportSlot } from "@/types/push-report";
import { addDaysISO } from "./push-schedule";

const fact = (it: FollowUpItem, label: string) => it.facts.find(f => f.label === label)?.value ?? "";
const isContact = (it: FollowUpItem) => it.kind === "initial" || it.kind === "recontact";
const isTodo = (it: FollowUpItem) => it.key.startsWith("todo:");

function contactItem(it: FollowUpItem): ReportItem {
  const result = it.kind === "initial" ? "미컨택" : fact(it, "연락 결과") || "다시 연락";
  return { key: it.key, label: it.company, detail: it.action, badge: it.badge, href: it.href, tag: result };
}
const plainItem = (it: FollowUpItem): ReportItem => ({ key: it.key, label: it.company, detail: it.action || it.detail, badge: it.badge, href: it.href,
  ...((it.overdueDays ?? 0) > 0 ? { overdueDays: it.overdueDays ?? 0 } : {}) });
function meetingItem(m: Meeting): ReportItem {
  const company = m.업체명.replace(/^\(변경\)\s*/, "");
  return { key: `meeting:${m.id}`, label: company, detail: m.장소.trim(), badge: m.미팅시간, time: m.미팅시간,
    href: `/schedule?date=${m.미팅날짜}&focus=${encodeURIComponent(m.id)}` };
}
const meetingsOn = (meetings: Meeting[], day: string) => meetings
  .filter(m => m.상태 === "예약" && m.미팅날짜 === day)
  .sort((a, b) => a.미팅시간.localeCompare(b.미팅시간));

const count = (sections: ReportSection[], key: ReportSection["key"]) => sections.find(s => s.key === key)?.items.length ?? 0;

export function buildDailyReport(slot: ReportSlot, summary: Pick<FollowUpSummary, "items" | "urgent">, meetings: Meeting[], today: string, sentAt: string): DailyReport {
  const tomorrow = addDaysISO(today, 1);
  const shown = new Set<string>();
  const take = (items: ReportItem[]) => { items.forEach(i => shown.add(i.key)); return items; };
  const todayMeetings = meetingsOn(meetings, today);
  // A 「오늘 챙길 일」 row for one of today's meetings is the meeting itself; never list it twice.
  todayMeetings.forEach(m => shown.add(`meeting:${m.id}`));
  let sections: ReportSection[];
  if (slot === "morning") {
    sections = [
      { key: "contact", title: "연락할 곳", items: take(summary.urgent.filter(i => isContact(i) && i.group === "today").map(contactItem)) },
      { key: "meeting", title: "오늘 미팅", items: todayMeetings.map(meetingItem) },
      { key: "work", title: "오늘 할 일", items: take(summary.urgent.filter(i => isTodo(i) && i.group === "today").map(plainItem)) },
    ];
  } else {
    const tomorrowItems = summary.items.filter(i => i.dueISO === tomorrow && !i.key.startsWith("meeting:"));
    sections = [
      { key: "left", title: "오늘 남은 일", items: take(summary.urgent.filter(i => (isContact(i) || isTodo(i)) && i.group === "today").map(i => (isContact(i) ? contactItem(i) : plainItem(i)))) },
      { key: "tomorrow", title: "내일 약속", items: [...meetingsOn(meetings, tomorrow).map(meetingItem), ...take(tomorrowItems.map(i => (isContact(i) ? contactItem(i) : plainItem(i))))] },
    ];
  }
  sections.push({ key: "missed", title: "놓친 일", items: summary.urgent.filter(i => !shown.has(i.key)).map(plainItem) });
  const headline = slot === "morning"
    ? `비서의 아침 요약이 도착했어요. 컨택 ${count(sections, "contact")} · 미팅 ${count(sections, "meeting")} · 실무 ${count(sections, "work")} · 놓친 일 ${count(sections, "missed")}`
    : `비서의 저녁 요약이 도착했어요. 남은 일 ${count(sections, "left")} · 내일 약속 ${count(sections, "tomorrow")} · 놓친 일 ${count(sections, "missed")}`;
  return { slot, localDate: today, sentAt, headline, sections };
}

/** True when every list is empty — the morning then falls back to 「오늘의 씨앗」 as before. */
export const isEmptyReport = (r: DailyReport) => r.sections.every(s => s.items.length === 0);
