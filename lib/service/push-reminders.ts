/**
 * 미리 알림 1단계 (belie 2026-10-26): alerts tied to a real appointment time, separate from the
 * morning/evening summaries. Pure — the dispatcher checks every 15-minute tick which reminders
 * fall inside the tick. The after-meeting result ask already exists (#1233, 시작 3시간 뒤) and stays there. Never before 07:00 or from 21:00; at most REMINDER_DAILY_LIMIT a day.
 *   meeting_before  미팅 시각 − (30·60·120분, 기본 60)
 *   todo_before     시간을 적은 할 일 15분 전
 *   absence_retry   부재로 오늘 다시 걸 DB — 지난 부재와 다른 시간대(오전↔오후) 15분 전
 */
import type { ContractPayment, Meeting, Todo } from "@/types";
import type { DbSheetLead } from "@/types/db-sheet";
import type { PushPreferences, ReminderKind } from "@/types/push";
import { contractRef, sameContractRef } from "@/util/contract-ref";
import { addDaysISO, type KstNow } from "./push-schedule";

export const REMINDER_DAILY_LIMIT = 6;
export const TODO_LEAD_MINUTES = 15;
export const ABSENCE_LEAD_MINUTES = 15;
const QUIET_START = 7 * 60, QUIET_END = 21 * 60, TICK = 15;

export interface ReminderSources { meetings?: Meeting[]; todos?: Todo[]; leads?: DbSheetLead[]; contracts?: ContractPayment[] }
export interface DueReminder { kind: ReminderKind; key: string; at: string; body: string; url: string; messageId: string }

const toMin = (hhmm: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const clip = (s: string, n = 16) => { const t = s.replace(/^\(변경\)\s*/, "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const leadLabel = (min: number) => (min % 60 === 0 ? `${min / 60}시간` : `${min}분`);
const clock = (h: number) => (h < 12 ? `오전 ${h}시` : h === 12 ? "낮 12시" : `오후 ${h - 12}시`);

/** True when `target` (minutes of the day) falls in this 15-minute tick and outside quiet hours. */
function dueNow(target: number | null, tick: number): target is number {
  return target !== null && target >= QUIET_START && target < QUIET_END && target >= tick && target < tick + TICK;
}

type ReminderPrefs = Pick<PushPreferences, "reminderKinds" | "meetingLeadMinutes" | "showCompanyNames">;

export function dueReminders(src: ReminderSources, prefs: ReminderPrefs, now: KstNow): DueReminder[] {
  const tick = toMin(now.time)!;
  const on = (k: ReminderKind) => prefs.reminderKinds.includes(k);
  const show = prefs.showCompanyNames;
  const out: Array<DueReminder & { order: number }> = [];

  for (const m of src.meetings ?? []) {
    if (m.상태 !== "예약" || m.미팅날짜 !== now.date) continue;
    const start = toMin(m.미팅시간);
    if (start === null) continue;
    const url = `/schedule?date=${m.미팅날짜}&focus=${encodeURIComponent(m.id)}`;
    const company = clip(m.업체명);
    if (on("meeting_before") && dueNow(start - prefs.meetingLeadMinutes, tick)) {
      const left = leadLabel(prefs.meetingLeadMinutes);
      out.push({ order: start, kind: "meeting_before", key: `meeting_before:${m.id}`, at: m.미팅시간, url, messageId: "reminder.meeting_before.v1",
        body: show ? `${m.미팅시간} ${company} 미팅, ${left} 남았어요. 지난 상담 메모 한 번 볼까요?` : `${left} 뒤 미팅이 있어요. 준비할 것을 한 번 볼까요?` });
    }
  }

  if (on("todo_before")) {
    for (const t of src.todos ?? []) {
      if ((t.기록종류 ?? "todo") !== "todo" || t.완료여부 || t.type === "일반" || t.예정일자 !== now.date) continue;
      const at = toMin(t.예정시각 ?? "");
      if (!dueNow(at === null ? null : at - TODO_LEAD_MINUTES, tick)) continue;
      const cp = (src.contracts ?? []).find(c => sameContractRef(t.contractRef, contractRef(c.계약일, c.업체명)));
      const company = clip(t.업체명 || cp?.업체명 || "");
      out.push({ order: at!, kind: "todo_before", key: `todo_before:${t.id}`, at: t.예정시각, messageId: "reminder.todo_before.v1",
        url: cp?.row != null ? `/payment?row=${cp.row}&focus=${encodeURIComponent(t.id)}` : "/calendar",
        body: show ? `15분 뒤 ${company ? `${company} ` : ""}「${clip(t.제목, 18)}」 하기로 하셨어요.` : "15분 뒤 하기로 한 일이 있어요." });
    }
  }

  if (on("absence_retry")) {
    for (const l of src.leads ?? []) {
      if (l.result !== "부재" || l.next !== now.date || l.meetingId || l.followUp?.lastContactDate === now.date) continue;
      const last = [...(l.absences ?? [])].filter(a => a.date < now.date).sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour).at(-1);
      if (!last) continue;
      const suggest = last.hour < 13 ? 15 : 10;
      if (!dueNow(suggest * 60 - ABSENCE_LEAD_MINUTES, tick)) continue;
      const when = last.date === addDaysISO(now.date, -1) ? "어제" : "지난번";
      out.push({ order: suggest * 60, kind: "absence_retry", key: `absence_retry:${l.id}`, at: hhmm(suggest * 60), messageId: "reminder.absence_retry.v1",
        url: show ? `/db-sheet?lead=${encodeURIComponent(l.id)}` : "/db-sheet",
        body: show ? `${when} ${clock(last.hour)}엔 부재였던 ${clip(l.company || "이름 없는 업체")}, ${clock(suggest)}에 다시 걸어 볼까요?`
          : `부재였던 DB에 다시 걸어 볼 시간이에요. 지난번과 다른 시간대예요.` });
    }
  }

  return out.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key)).map(({ order, ...r }) => { void order; return r; });
}
