/** Pure follow-up rules shared by the dashboard and its acceptance tests. */
import { todoSlotOf } from "./todo-slot";
import { contractRef, normalizeContractRef, sameContractRef } from "@/util/contract-ref";
import type { ContractPayment, Meeting, PaymentSlot, Todo } from "@/types";
import { isDbSheetFollowUpResult, type DbSheetLead } from "@/types/db-sheet";
import { addDays, diffDays, fmtISO, isValidISODate, parseISO } from "@/util/week";
import { normalizeInstitution } from "@/util/institution-match";
import { activeWorkContracts, isSlotClosed, slotHasData } from "./payment-work-status";

export const STALL_DAYS = 7;
export const UPCOMING_DAYS = 7;
/** Legacy calendar helper only. Dashboard uses the unbounded pending-meetings endpoint. */
export const UNRESULTED_LOOKBACK_DAYS = 30;
export type FollowUpKind = "initial" | "overdue" | "today" | "meeting" | "recontact" | "stalled" | "upcoming";
export const FOLLOW_UP_KINDS: readonly FollowUpKind[] = ["initial", "overdue", "today", "meeting", "recontact", "stalled", "upcoming"];
export type FollowUpStep = "1.5" | "2" | "3" | "4";
export type FollowUpGroup = "today" | "overdue" | "long-overdue" | "upcoming" | "unknown";
export interface FollowUpItem {
  key: string; kind: FollowUpKind; step: FollowUpStep; group: FollowUpGroup;
  title: string; company: string; detail: string; badge: string; href: string;
  dueISO: string | null; overdueDays: number | null; action: string; reasons: string[];
  facts: Array<{ label: string; value: string }>; slot?: 1 | 2 | 3;
}
export type FollowUpCounts = Record<FollowUpKind, number>;
const SLOTS = [1, 2, 3] as const;
const shiftISO = (iso: string, days: number) => fmtISO(addDays(parseISO(iso), days));
const daysBetween = (later: string, earlier: string) => diffDays(parseISO(later), parseISO(earlier));
const contractRefOf = (cp: ContractPayment) => contractRef(cp.계약일, cp.업체명);
const slotOf = (cp: ContractPayment, slot: 1 | 2 | 3): PaymentSlot => cp[`수납${slot}`];
const visibleSlots = (cp: ContractPayment): Array<1 | 2 | 3> => {
  const populated = SLOTS.filter(slot => slotHasData(slotOf(cp, slot)));
  return populated.length ? populated : [1];
};
function timing(due: string | null, today: string) {
  const dueISO = due && isValidISODate(due) ? due : null;
  const overdueDays = dueISO ? daysBetween(today, dueISO) : null;
  const group: FollowUpGroup = overdueDays === null ? "unknown" : overdueDays < 0 ? "upcoming" : overdueDays === 0 ? "today" : overdueDays >= STALL_DAYS ? "long-overdue" : "overdue";
  const badge = overdueDays === null ? "날짜 확인" : overdueDays === 0 ? "오늘" : `D${overdueDays > 0 ? "+" : "-"}${String(Math.abs(overdueDays)).padStart(2, "0")}`;
  return { dueISO, overdueDays, group, badge };
}
function item(base: Omit<FollowUpItem, "dueISO" | "overdueDays" | "group" | "badge" | "company">, due: string | null, today: string): FollowUpItem {
  return { ...base, company: base.title, ...timing(due, today) };
}
export function compareFollowUpUrgency(a: FollowUpItem, b: FollowUpItem): number {
  const rank: Record<FollowUpGroup, number> = { "long-overdue": 0, overdue: 1, today: 2, unknown: 3, upcoming: 4 };
  return rank[a.group] - rank[b.group] || (a.dueISO ?? "9999").localeCompare(b.dueISO ?? "9999") || a.key.localeCompare(b.key);
}
export interface TodoFollowUps { overdue: FollowUpItem[]; today: FollowUpItem[]; upcoming: FollowUpItem[]; unlinked: number }
/** 기록의 진행건 — 번호가 있으면 그대로, 옛 기록은 기관이 한 진행건에만 맞을 때만(정본: todo-slot). */
function slotForTodo(cp: ContractPayment, todo: Todo): 1 | 2 | 3 | undefined {
  const { slot, ambiguous } = todoSlotOf(cp, todo);
  return slot && !ambiguous ? slot : undefined;
}
export function buildTodoFollowUps(todos: Todo[], contracts: ContractPayment[], today: string): TodoFollowUps {
  const byRef = new Map(contracts.map(cp => [contractRefOf(cp), cp]));
  const active = new Set(activeWorkContracts(contracts));
  const out: TodoFollowUps = { overdue: [], today: [], upcoming: [], unlinked: 0 };
  const seen = new Set<string>();
  for (const t of [...todos].sort((a, b) => a.예정일자.localeCompare(b.예정일자) || (a.예정시각 || "99").localeCompare(b.예정시각 || "99"))) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    if ((t.기록종류 ?? "todo") !== "todo" || t.완료여부 || t.type === "일반" || !isValidISODate(t.예정일자) || t.예정일자 > shiftISO(today, UPCOMING_DAYS)) continue;
    const cp = byRef.get(normalizeContractRef(t.contractRef));
    if (cp && !active.has(cp)) continue;
    if (!cp || cp.row == null) { out.unlinked++; continue; }
    const slot = slotForTodo(cp, t);
    if (slot ? isSlotClosed(slotOf(cp, slot), today) : visibleSlots(cp).every(n => isSlotClosed(slotOf(cp, n), today))) continue;
    const kind = t.예정일자 < today ? "overdue" : t.예정일자 === today ? "today" : "upcoming";
    out[kind].push(item({ key: `todo:${t.id}`, kind, step: "4", slot,
      title: t.업체명.trim() || cp.업체명 || t.제목,
      detail: [t.제목, normalizeInstitution(t.institutionRef), t.예정시각].filter(Boolean).join(" · "),
      action: t.제목, reasons: ["미완료 할 일", ...(!slot ? ["연결 진행건 확인 필요"] : [])], facts: [{ label: "예정일", value: t.예정일자 }, { label: "진행", value: slot ? String(slot) : "확인 필요" }],
      href: `/payment?row=${cp.row}${slot ? `&slot=${slot}` : ""}&focus=${encodeURIComponent(t.id)}`,
    }, t.예정일자, today));
  }
  return out;
}
/** Kept for other calendar consumers, never used to limit pending follow-ups. */
export function meetingLookbackMonths(today: string): string[] {
  const from = parseISO(shiftISO(today, -UNRESULTED_LOOKBACK_DAYS)), to = parseISO(shiftISO(today, -1));
  const months: string[] = [];
  for (let y = from.getFullYear(), m = from.getMonth(); y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth());) {
    months.push(`${y}-${String(m + 1).padStart(2, "0")}`); m++; if (m === 12) { m = 0; y++; }
  }
  return months;
}
export function buildUnresultedMeetings(meetings: Meeting[], today: string): FollowUpItem[] {
  const seen = new Set<string>();
  return meetings.filter(m => {
    if (seen.has(m.id)) return false; seen.add(m.id);
    return m.상태 === "예약" && isValidISODate(m.미팅날짜) && m.미팅날짜 <= shiftISO(today, UPCOMING_DAYS);
  }).sort((a, b) => a.미팅날짜.localeCompare(b.미팅날짜) || a.미팅시간.localeCompare(b.미팅시간)).map(m => item({
    key: `meeting:${m.id}`, kind: "meeting", step: "3", title: m.업체명.replace(/^\(변경\)\s*/, ""),
    detail: [m.미팅날짜, m.미팅시간, m.장소.trim()].filter(Boolean).join(" · "),
    action: m.미팅날짜 > today ? "미팅 준비" : "미팅 결과 입력", reasons: [m.미팅날짜 > today ? "미팅 예정" : "미팅 결과 미입력"], facts: [{ label: "미팅일", value: m.미팅날짜 }, { label: "시간", value: m.미팅시간 }],
    href: `/schedule?date=${m.미팅날짜}&focus=${encodeURIComponent(m.id)}`,
  }, m.미팅날짜, today));
}
function leadIsActive(lead: DbSheetLead) { return !lead.meetingId && lead.funnel !== "계약" && lead.stage !== "계약해지"; }
function leadItem(lead: DbSheetLead, today: string, initial: boolean, due: string | null, reason: string): FollowUpItem {
  return item({ key: `lead:${lead.id}`, kind: initial ? "initial" : "recontact", step: initial ? "1.5" : "2",
    title: lead.company.trim() || "이름 없는 업체", detail: `${lead.result} · ${lead.channel}`,
    action: initial ? "첫 연락하기" : reason === "다음 연락일 없음" ? "다음 연락일 정하기" : "다시 연락하기",
    reasons: [reason], facts: [{ label: "유입일", value: lead.date }, { label: "연락 결과", value: lead.result }, { label: "다음 연락일", value: lead.next || "미정" }],
    href: `/db-sheet?lead=${encodeURIComponent(lead.id)}`,
  }, due, today);
}
export function buildInitialLeads(leads: DbSheetLead[], today: string): FollowUpItem[] {
  return leads.filter(l => leadIsActive(l) && l.result === "미컨택" && !l.first && !l.followUp?.lastContactDate && (!isValidISODate(l.date) || l.date <= today))
    .map(l => leadItem(l, today, true, l.date, "첫 연락 전")).sort(compareFollowUpUrgency);
}
export function buildRecontactLeads(leads: DbSheetLead[], today: string): FollowUpItem[] {
  return leads.filter(l => leadIsActive(l) && l.result !== "미컨택" && isDbSheetFollowUpResult(l.result)).flatMap(l => {
    const completed = l.followUp && l.followUp.completedGeneration === l.followUp.generation;
    if (isValidISODate(l.next) && !completed) {
      return l.next <= shiftISO(today, UPCOMING_DAYS) ? [leadItem(l, today, false, l.next, "다시 연락 예정")] : [];
    }
    if (!["부재", "컨택진행", "재통화"].includes(l.result)) return [];
    // A completed contact consumes its old reservation. A fresh reservation is a new generation.
    return [leadItem(l, today, false, l.followUp?.lastContactDate || null, "다음 연락일 없음")];
  }).sort(compareFollowUpUrgency);
}
/** One row per active work slot; missing institution and missing next task are reasons on that row. */
export function buildStalledWork(contracts: ContractPayment[], todos: Todo[], today: string, stallDays = STALL_DAYS): FollowUpItem[] {
  const out: FollowUpItem[] = [];
  for (const cp of activeWorkContracts(contracts)) {
    for (const slot of visibleSlots(cp)) {
      const data = slotOf(cp, slot), institution = normalizeInstitution(data.진행기관);
      if (isSlotClosed(data, today)) continue;
      const records = todos.filter(t => sameContractRef(t.contractRef, contractRefOf(cp)) && slotForTodo(cp, t) === slot && t.type !== "일반");
      const open = records.filter(t => (t.기록종류 ?? "todo") === "todo" && !t.완료여부 && isValidISODate(t.예정일자));
      const activity = records.filter(t => t.기록종류 === "history" || t.완료여부).map(t => t.예정일자)
        .filter(d => isValidISODate(d) && d <= today).sort().at(-1);
      const last = activity || (isValidISODate(cp.계약일) ? cp.계약일 : null);
      const reasons = [!institution ? "진행기관 없음" : "", !open.length ? "다음 할 일 없음" : ""].filter(Boolean);
      const stalled = last !== null && daysBetween(today, last) >= stallDays;
      if (!reasons.length) continue;
      if (stalled) reasons.push(`${stallDays}일 이상 진행 정체`);
      out.push(item({ key: `stalled:${cp.row ?? contractRefOf(cp)}:${slot}`, kind: "stalled", step: "4", slot,
        title: cp.업체명, detail: [`진행 ${slot}`, institution || "기관 미정", data.진행상품.trim(), ...reasons].filter(Boolean).join(" · "),
        action: !institution ? "진행기관과 다음 할 일 확인" : "다음 할 일 정하기", reasons,
        facts: [{ label: "진행", value: String(slot) }, { label: "기관", value: institution || "미정" }, { label: activity ? "마지막 일정" : "계약일", value: last ?? "확인 필요" }],
        href: cp.row == null ? "/payment" : `/payment?row=${cp.row}&slot=${slot}`,
      }, last, today));
    }
  }
  return out.sort(compareFollowUpUrgency);
}
export function followUpTotal(counts: FollowUpCounts): number { return FOLLOW_UP_KINDS.filter(k => k !== "upcoming").reduce((sum, key) => sum + (counts[key] ?? 0), 0); }
export function followUpHeadline(counts: FollowUpCounts): string {
  if (counts.overdue) return `밀린 할 일 ${counts.overdue}건부터 정리해요`;
  if (counts.meeting) return `미팅 ${counts.meeting}건 결과를 적어 주세요`;
  if (counts.today) return `오늘 할 일 ${counts.today}건, 하나씩 끝내 봐요`;
  if (counts.initial) return `첫 연락할 DB가 ${counts.initial}곳 있어요`;
  if (counts.recontact) return `다시 연락할 DB가 ${counts.recontact}곳 있어요`;
  if (counts.stalled) return `다음 진행을 정할 일이 ${counts.stalled}건 있어요`;
  return "오늘 챙길 일이 없어요 👏";
}
export interface FollowUpSources { contracts?: ContractPayment[]; todos?: Todo[]; meetings?: Meeting[]; leads?: DbSheetLead[] }
export interface FollowUpSummary {
  groups: Record<FollowUpKind, FollowUpItem[]>; counts: FollowUpCounts; total: number; headline: string; unlinkedTodos: number;
  items: FollowUpItem[]; urgent: FollowUpItem[]; stepCounts: Record<FollowUpStep, number>; groupCounts: Record<FollowUpGroup, number>;
}
export function summarizeFollowUps(src: FollowUpSources, today: string): FollowUpSummary {
  const todo = src.contracts && src.todos ? buildTodoFollowUps(src.todos, src.contracts, today) : { overdue: [], today: [], upcoming: [], unlinked: 0 };
  const all = [...todo.overdue, ...todo.today, ...todo.upcoming,
    ...(src.meetings ? buildUnresultedMeetings(src.meetings, today) : []),
    ...(src.leads ? [...buildInitialLeads(src.leads, today), ...buildRecontactLeads(src.leads, today)] : []),
    ...(src.contracts && src.todos ? buildStalledWork(src.contracts, src.todos, today) : [])];
  const items = [...new Map(all.map(i => [i.key, i])).values()].sort(compareFollowUpUrgency);
  const urgent = items.filter(i => i.group !== "upcoming");
  const groups = Object.fromEntries(FOLLOW_UP_KINDS.map(k => [k, items.filter(i => k === "upcoming" ? i.group === "upcoming" : i.kind === k && i.group !== "upcoming")])) as Record<FollowUpKind, FollowUpItem[]>;
  const counts = Object.fromEntries(FOLLOW_UP_KINDS.map(k => [k, groups[k].length])) as FollowUpCounts;
  const stepCounts = Object.fromEntries((["1.5", "2", "3", "4"] as const).map(step => [step, urgent.filter(i => i.step === step).length])) as Record<FollowUpStep, number>;
  const groupCounts = Object.fromEntries((["today", "overdue", "long-overdue", "upcoming", "unknown"] as const).map(group => [group, items.filter(i => i.group === group).length])) as Record<FollowUpGroup, number>;
  return { groups, counts, total: urgent.length, headline: followUpHeadline(counts), unlinkedTodos: todo.unlinked, items, urgent, stepCounts, groupCounts };
}
