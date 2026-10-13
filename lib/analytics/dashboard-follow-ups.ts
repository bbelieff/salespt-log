/**
 * 대시보드 「오늘 챙길 일」 — 이미 있는 조회 4종(계약·할 일·월 미팅·DB관리시트)을 화면에서 계산하는 순수 함수.
 * React·fetch 없음. 기준일은 호출부가 넘기는 todayKST()(대시보드 page.tsx). 날짜 리터럴 금지(G5).
 * SSOT: docs/design/components.md §9 DashboardFollowUps.
 */
import type { ContractPayment, Meeting, PaymentSlot, Todo } from "@/types";
import { isDbSheetFollowUpResult, type DbSheetLead } from "@/types/db-sheet";
import { addDays, diffDays, fmtISO, isValidISODate, parseISO } from "@/util/week";
import { normalizeInstitution } from "@/util/institution-match";
import {
  activeWorkContracts,
  buildSlotActivityIndex,
  classifyWorkStatus,
  slotActivityKey,
  slotHasData,
} from "@/lib/analytics/payment-work-status";

/** 다음 할 일 없이 이만큼(이상) 지나면 「멈춘 업체」. belie 기본안 2026-10-12(7일·이월 포함). */
export const STALL_DAYS = 7;
/** 결과를 안 적은 지난 미팅을 이 기간까지만 본다(그보다 오래된 예약은 정리 대상이 아니라 기록 누락). */
export const UNRESULTED_LOOKBACK_DAYS = 30;
/** 보조 칩 「7일 안 할 일」 범위. */
export const UPCOMING_DAYS = 7;

export type FollowUpKind = "overdue" | "today" | "meeting" | "recontact" | "stalled" | "upcoming";
/** 칩·목록 순서. upcoming 은 보조 칩이라 총건수에서 뺀다. */
export const FOLLOW_UP_KINDS: readonly FollowUpKind[] = ["overdue", "today", "meeting", "recontact", "stalled", "upcoming"];

export interface FollowUpItem {
  key: string;
  kind: FollowUpKind;
  title: string;
  detail: string;
  badge: string;
  href: string;
}

export type FollowUpCounts = Record<FollowUpKind, number>;

const KO_DAY = ["일", "월", "화", "수", "목", "금", "토"];
const SLOTS = [1, 2, 3] as const;
const RESCHEDULED_PREFIX = /^\(변경\)\s*/;

const shiftISO = (iso: string, days: number) => fmtISO(addDays(parseISO(iso), days));
/** later − earlier (일). */
const daysBetween = (laterISO: string, earlierISO: string) => diffDays(parseISO(laterISO), parseISO(earlierISO));
const fmtMD = (iso: string) => { const d = parseISO(iso); return `${d.getMonth() + 1}/${d.getDate()}`; };
const weekdayOf = (iso: string) => KO_DAY[parseISO(iso).getDay()] ?? "";
/**
 * D 배지는 실무/수납 목록(institution-view.ts activityLabel)과 같은 두 자리 형식(D+03)으로 통일한다 —
 * 대시보드에서 눌러 들어간 같은 할 일이 두 화면에서 같은 배지로 보이게. 오늘은 쉬운 말 「오늘」.
 */
const dPlus = (days: number) => `D+${String(days).padStart(2, "0")}`;
const dMinus = (days: number) => `D-${String(days).padStart(2, "0")}`;
const contractRefOf = (cp: Pick<ContractPayment, "계약일" | "업체명">) => `${cp.계약일}|${cp.업체명}`;
const slotOf = (cp: ContractPayment, slot: 1 | 2 | 3): PaymentSlot => cp[`수납${slot}`];
/** 데이터가 있는 진행 슬롯, 없으면 진행 1(실무/수납 institution-view.ts 와 같은 규칙). */
const visibleSlots = (cp: ContractPayment): Array<1 | 2 | 3> => {
  const populated = SLOTS.filter((slot) => slotHasData(slotOf(cp, slot)));
  return populated.length ? populated : [1];
};

// ── ① 할 일 ────────────────────────────────────────────────────

export interface TodoFollowUps {
  overdue: FollowUpItem[];
  today: FollowUpItem[];
  upcoming: FollowUpItem[];
  /** 계약을 찾지 못한(업체명·계약일이 바뀌었거나 행이 없는) 미완료 할 일 — 링크로 열 수 없어 칩·총건수에서 뺀다. */
  unlinked: number;
}

function slotForTodo(cp: ContractPayment, institutionRef: string): 1 | 2 | 3 {
  const wanted = normalizeInstitution(institutionRef);
  return SLOTS.find((slot) => normalizeInstitution(slotOf(cp, slot).진행기관) === wanted)
    ?? SLOTS.find((slot) => slotHasData(slotOf(cp, slot)))
    ?? 1;
}

const byScheduleTime = (a: Todo, b: Todo) =>
  a.예정일자.localeCompare(b.예정일자) ||
  (a.예정시각 ? (b.예정시각 ? a.예정시각.localeCompare(b.예정시각) : -1) : b.예정시각 ? 1 : 0);

export function buildTodoFollowUps(todos: Todo[], contracts: ContractPayment[], todayISO: string): TodoFollowUps {
  const byRef = new Map(contracts.map((cp) => [contractRefOf(cp), cp] as const));
  const active = new Set(activeWorkContracts(contracts));
  const upcomingEnd = shiftISO(todayISO, UPCOMING_DAYS);
  const out: TodoFollowUps = { overdue: [], today: [], upcoming: [], unlinked: 0 };
  const open = todos
    .filter((t) => (t.기록종류 ?? "todo") === "todo" && !t.완료여부 && t.type !== "일반" && isValidISODate(t.예정일자))
    .filter((t) => t.예정일자 <= upcomingEnd)
    .sort(byScheduleTime);
  for (const todo of open) {
    const cp = byRef.get(todo.contractRef);
    if (cp && !active.has(cp)) continue; // 해지·숨김 계약의 할 일은 챙길 일이 아니다
    if (!cp || cp.row == null) { out.unlinked++; continue; }
    const slot = slotForTodo(cp, todo.institutionRef);
    const company = todo.업체명.trim() || cp.업체명;
    const item: FollowUpItem = {
      key: `todo:${todo.id}`,
      kind: "overdue",
      title: company || todo.제목,
      detail: [company ? todo.제목 : "", normalizeInstitution(todo.institutionRef), todo.예정시각].filter(Boolean).join(" · "),
      badge: "",
      href: `/payment?row=${cp.row}&slot=${slot}&focus=${encodeURIComponent(todo.id)}`,
    };
    if (todo.예정일자 < todayISO) out.overdue.push({ ...item, kind: "overdue", badge: dPlus(daysBetween(todayISO, todo.예정일자)) });
    else if (todo.예정일자 === todayISO) out.today.push({ ...item, kind: "today", badge: "오늘" });
    else out.upcoming.push({ ...item, kind: "upcoming", badge: dMinus(daysBetween(todo.예정일자, todayISO)) });
  }
  return out;
}

// ── ② 결과를 안 적은 지난 미팅 ─────────────────────────────────

/** today−30 ~ today−1 이 걸치는 서로 다른 yyyy-MM(1~3개, 오래된 달부터). */
export function meetingLookbackMonths(todayISO: string): string[] {
  const from = parseISO(shiftISO(todayISO, -UNRESULTED_LOOKBACK_DAYS));
  const to = parseISO(shiftISO(todayISO, -1));
  const months: string[] = [];
  for (let y = from.getFullYear(), m = from.getMonth(); y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth());) {
    months.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m += 1;
    if (m === 12) { m = 0; y += 1; }
  }
  return months;
}

/**
 * 상태 '예약'인 지난 미팅만 — 계약·완료·취소는 결과가 있고, 변경은 원본 무효(새 예약 행이 대신한다).
 */
export function buildUnresultedMeetings(meetings: Meeting[], todayISO: string): FollowUpItem[] {
  const from = shiftISO(todayISO, -UNRESULTED_LOOKBACK_DAYS);
  const seen = new Set<string>();
  return meetings
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return m.상태 === "예약" && isValidISODate(m.미팅날짜) && m.미팅날짜 >= from && m.미팅날짜 < todayISO;
    })
    .sort((a, b) => a.미팅날짜.localeCompare(b.미팅날짜) || a.미팅시간.localeCompare(b.미팅시간))
    .map((m) => ({
      key: `meeting:${m.id}`,
      kind: "meeting" as const,
      title: m.업체명.replace(RESCHEDULED_PREFIX, ""),
      detail: [`${fmtMD(m.미팅날짜)}(${weekdayOf(m.미팅날짜)}) ${m.미팅시간}`.trim(), m.장소.trim()].filter(Boolean).join(" · "),
      badge: dPlus(daysBetween(todayISO, m.미팅날짜)),
      href: `/schedule?date=${m.미팅날짜}&focus=${encodeURIComponent(m.id)}`,
    }));
}

// ── ③ 다시 연락할 DB ───────────────────────────────────────────

/**
 * 다음 연락일이 오늘이거나 지난 업체. 다음 연락일은 손으로 고치는 칸이라, 그날 이후에 상담 기록이
 * 있으면(이미 다시 연락함) 뺀다. 전화번호는 대시보드에 내보내지 않는다.
 */
export function buildRecontactLeads(leads: DbSheetLead[], todayISO: string): FollowUpItem[] {
  return leads
    .filter((lead) => {
      if (!isDbSheetFollowUpResult(lead.result) || !isValidISODate(lead.next) || lead.next > todayISO) return false;
      const contacted = lead.contact?.date ?? "";
      return !(isValidISODate(contacted) && contacted >= lead.next);
    })
    .sort((a, b) => a.next.localeCompare(b.next))
    .map((lead) => ({
      key: `lead:${lead.id}`,
      kind: "recontact" as const,
      title: lead.company.trim() || lead.owner.trim() || "이름 없는 업체",
      detail: `${lead.result} · ${lead.channel}`,
      badge: lead.next === todayISO ? "오늘" : dPlus(daysBetween(todayISO, lead.next)),
      href: `/db-sheet?lead=${encodeURIComponent(lead.id)}`,
    }));
}

// ── ④ 멈춘 업체 ────────────────────────────────────────────────

/**
 * 「다음 할 일을 정하지 않은 채 멈춘 업체」. 업체(계약) 단위로 세고 가장 오래 멈춘 진행 1건으로 연결한다.
 * - 범위: 해지·숨김 제외, 이월 포함(ADR-0034). 계약일이 없는 계약은 할 일을 붙일 수 없어 뺀다.
 * - 진행대기·진행만 본다. 승인·수납대기·수납완료는 수납 단계라 넣지 않는다(#5 반려).
 * - 예정된(미완료) 할 일이 있는 진행은 멈춤이 아니다. 어느 진행과도 기관명이 맞지 않는 미완료 할 일이
 *   있는 계약도 뺀다(같은 업체가 할 일 칩과 멈춤 칩에 겹쳐 보이지 않게).
 * - 마지막 일정 = max(History 날짜, 완료한 할 일의 예정일(미래면 오늘로 자름)). Todo 에 완료 시각이 없어
 *   「실제로 한 날」이 아니라 「마지막으로 잡혀 있던 일정」이다 — 화면 문구도 「마지막 일정」.
 */
export function buildStalledWork(
  contracts: ContractPayment[], todos: Todo[], todayISO: string, stallDays = STALL_DAYS,
): FollowUpItem[] {
  const index = buildSlotActivityIndex(todos);
  const openRefs = new Map<string, Set<string>>(); // contractRef → 미완료 할 일 기관명들
  for (const t of todos) {
    if ((t.기록종류 ?? "todo") !== "todo" || t.완료여부 || !t.예정일자.trim()) continue;
    const set = openRefs.get(t.contractRef) ?? new Set<string>();
    set.add(normalizeInstitution(t.institutionRef));
    openRefs.set(t.contractRef, set);
  }
  const ranked: Array<{ item: FollowUpItem; diff: number }> = [];
  for (const cp of activeWorkContracts(contracts)) {
    if (!isValidISODate(cp.계약일)) continue;
    const ref = contractRefOf(cp);
    const slots = visibleSlots(cp);
    const slotInstitutions = new Set(slots.map((slot) => normalizeInstitution(slotOf(cp, slot).진행기관)));
    if ([...(openRefs.get(ref) ?? [])].some((inst) => !slotInstitutions.has(inst))) continue;
    const stalled: Array<{ slot: 1 | 2 | 3; diff: number; last: string }> = [];
    for (const slot of slots) {
      const data = slotOf(cp, slot);
      const activity = index.get(slotActivityKey(ref, data.진행기관));
      if (activity?.todo) continue;
      const status = classifyWorkStatus(data, false, todayISO);
      if (status !== "waiting" && status !== "progress") continue;
      const done = activity?.done ? (activity.done > todayISO ? todayISO : activity.done) : "";
      const last = [activity?.history ?? "", done].reduce((a, b) => (b > a ? b : a), "");
      const diff = daysBetween(todayISO, last || cp.계약일);
      if (diff >= stallDays) stalled.push({ slot, diff, last });
    }
    if (!stalled.length) continue;
    const worst = stalled.reduce((a, b) => (b.diff > a.diff ? b : a));
    const data = slotOf(cp, worst.slot);
    const product = data.진행상품.trim();
    const parts = [
      `진행 ${worst.slot} · ${normalizeInstitution(data.진행기관) || "기관 미정"}${product ? ` · ${product}` : ""}`,
      worst.last ? `마지막 일정 ${fmtMD(worst.last)}` : "아직 일정 없음",
      stalled.length > 1 ? `멈춘 진행 ${stalled.length}건` : "",
    ];
    ranked.push({
      diff: worst.diff,
      item: {
        key: `stalled:${cp.row ?? ref}`,
        kind: "stalled",
        title: cp.업체명,
        detail: parts.filter(Boolean).join(" · "),
        badge: worst.last ? `${worst.diff}일째` : `계약 후 ${worst.diff}일`,
        href: cp.row == null ? "/payment" : `/payment?row=${cp.row}&slot=${worst.slot}`,
      },
    });
  }
  return ranked.sort((a, b) => b.diff - a.diff).map((r) => r.item);
}

// ── 총건수·한 줄 문구 ──────────────────────────────────────────

/** 총건수 = 보조 칩(7일 안 할 일)을 뺀 5종의 합. */
export function followUpTotal(counts: FollowUpCounts): number {
  return counts.overdue + counts.today + counts.meeting + counts.recontact + counts.stalled;
}

/** 우선순위: 밀린 할 일 > 지난 미팅 > 오늘 할 일 > 다시 연락 > 멈춘 업체. */
export function followUpHeadline(counts: FollowUpCounts): string {
  if (counts.overdue > 0) return `밀린 할 일 ${counts.overdue}건부터 정리해요`;
  if (counts.meeting > 0) return `지난 미팅 ${counts.meeting}건 결과를 적어 주세요`;
  if (counts.today > 0) return `오늘 할 일 ${counts.today}건, 하나씩 끝내 봐요`;
  if (counts.recontact > 0) return `다시 연락할 DB가 ${counts.recontact}곳 있어요`;
  if (counts.stalled > 0) return `${counts.stalled}곳이 ${STALL_DAYS}일 이상 다음 할 일 없이 멈춰 있어요`;
  return "오늘 챙길 일이 없어요 👏";
}

export interface FollowUpSources {
  /** 조회에 실패했거나 아직 없으면 undefined — 그 종류는 비워 둔다(카드가 실패 줄을 따로 보인다). */
  contracts?: ContractPayment[];
  todos?: Todo[];
  meetings?: Meeting[];
  leads?: DbSheetLead[];
}

export interface FollowUpSummary {
  groups: Record<FollowUpKind, FollowUpItem[]>;
  counts: FollowUpCounts;
  total: number;
  headline: string;
  unlinkedTodos: number;
}

export function summarizeFollowUps(src: FollowUpSources, todayISO: string): FollowUpSummary {
  const todoGroups = src.contracts && src.todos
    ? buildTodoFollowUps(src.todos, src.contracts, todayISO)
    : { overdue: [], today: [], upcoming: [], unlinked: 0 };
  const groups: Record<FollowUpKind, FollowUpItem[]> = {
    overdue: todoGroups.overdue,
    today: todoGroups.today,
    meeting: src.meetings ? buildUnresultedMeetings(src.meetings, todayISO) : [],
    recontact: src.leads ? buildRecontactLeads(src.leads, todayISO) : [],
    stalled: src.contracts && src.todos ? buildStalledWork(src.contracts, src.todos, todayISO) : [],
    upcoming: todoGroups.upcoming,
  };
  const counts = Object.fromEntries(FOLLOW_UP_KINDS.map((kind) => [kind, groups[kind].length])) as FollowUpCounts;
  return { groups, counts, total: followUpTotal(counts), headline: followUpHeadline(counts), unlinkedTodos: todoGroups.unlinked };
}
