/**
 * 배지 판정 — 순수 함수(DB 접근 없음). 기록을 읽어 배지마다 얻은 날짜·진행 정도를 계산한다.
 * 저장하지 않는다: 매번 기록에서 다시 계산하므로 같은 기록이면 같은 결과다(배지 회수 규칙 없음).
 * - 날짜는 활동한 날(KST). 오늘보다 뒤 날짜는 세지 않는다.
 * - 영업활동일은 activity-days(#1195)·activity-events(#1214) 판정을 그대로 쓴다.
 * - 계약은 이월(구분="이월") 제외 — 앞 기수에서 넘어온 계약은 이번에 기록한 계약이 아니다.
 */
import type { ContractPayment, Meeting, Todo } from "@/types";
import { activityDays } from "./activity-days";
import { toActivityEvents } from "./activity-events";
import { BADGES, type BadgeDef } from "./badge-catalog";

/** 연락 1회(DB관리시트). leadId 로 같은 업체의 연락 흐름을 본다. */
export interface BadgeContactRow { leadId: string; date: string; result: string }
/** DB관리시트 업체 1곳 — 유입일과 업체정보 3칸(업종·매출·지역)만. */
export interface BadgeLeadRow { date: string; industry: string; sales: string; address: string }

export interface BadgeSources {
  contacts: readonly BadgeContactRow[];
  meetings: readonly Meeting[];
  contracts: readonly ContractPayment[];
  todos: readonly Todo[];
  leads: readonly BadgeLeadRow[];
  /** DB생산 탭 4섹션의 날짜들(구매일·시작일·날짜·접수일). */
  dbTabDates: readonly string[];
  /** 주간목표를 처음 저장한 날. */
  firstGoalOn: string | null;
  /** 이 계정에서 알림을 처음 켠 날. */
  pushOnSince: string | null;
  /** 수료일(종강총회). 모르면 null. */
  graduationOn: string | null;
}

export interface BadgeProgress { cur: number; max: number; unit: string }
export interface BadgeState {
  id: string;
  earned: boolean;
  /** 얻은 날. 얻었지만 날짜를 알 수 없으면 null(업체정보 준비). */
  earnedOn: string | null;
  progress: BadgeProgress | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const QUALIFIED = new Set(["컨택진행", "상담 후 거절"]);
const NOT_A_CONTACT = new Set(["미컨택", "AS예정", ""]);

function valid(d: string | null | undefined, today: string): d is string {
  return !!d && ISO.test(d) && d <= today;
}
function minDate(dates: Iterable<string | null | undefined>, today: string): string | null {
  let best: string | null = null;
  for (const d of dates) if (valid(d, today) && (best === null || d < best)) best = d;
  return best;
}
/** n번째(1부터) 날짜. 모자라면 null. */
function nth(sorted: readonly string[], n: number): string | null {
  return sorted.length >= n ? sorted[n - 1]! : null;
}
/** ISO 시각 → KST 날짜. 날짜만 있으면 그대로. */
function kstDate(ts: string): string {
  if (ISO.test(ts)) return ts;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? "" : new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);
}
const filled = (s: string) => s.trim() !== "";

/** 부재 3번 뒤 같은 업체와 상담 성사한 첫 날. */
function gritDay(contacts: readonly BadgeContactRow[], today: string): string | null {
  const byLead = new Map<string, BadgeContactRow[]>();
  for (const c of contacts) if (valid(c.date, today)) byLead.set(c.leadId, [...(byLead.get(c.leadId) ?? []), c]);
  let best: string | null = null;
  for (const rows of byLead.values()) {
    let absent = 0;
    for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
      if (r.result === "부재") absent += 1;
      else if (QUALIFIED.has(r.result)) {
        if (absent >= 3 && (best === null || r.date < best)) best = r.date;
        break;
      }
    }
  }
  return best;
}

/** 한 날에 연락·미팅·계약을 모두 기록한 첫 날. */
function fullDay(src: BadgeSources, contractDates: readonly string[], today: string): string | null {
  const contact = new Set(src.contacts.filter(c => !NOT_A_CONTACT.has(c.result)).map(c => c.date));
  const meeting = new Set<string>();
  for (const m of src.meetings) {
    meeting.add(m.예약일);
    if (m.상태 === "완료" || m.상태 === "계약") meeting.add(m.미팅날짜);
  }
  return minDate(contractDates.filter(d => contact.has(d) && meeting.has(d)), today);
}

export function judgeBadges(src: BadgeSources, today: string): BadgeState[] {
  const days = activityDays(toActivityEvents({
    contacts: src.contacts, meetings: src.meetings, contracts: src.contracts, todos: src.todos,
  }), today);
  const salesDays = [...days].filter(([, k]) => k === "sales").map(([d]) => d).sort();
  const grad = valid(src.graduationOn, today) ? src.graduationOn : null;
  const alumniDays = grad ? salesDays.filter(d => d > grad) : [];
  const contractDates = src.contracts.filter(c => c.구분 !== "이월" && valid(c.계약일, today)).map(c => c.계약일).sort();
  const companyBest = Math.max(0, ...src.leads.map(l => [l.industry, l.sales, l.address].filter(filled).length));

  const earnedOn: Record<string, string | null> = {
    "first-activity": nth(salesDays, 1),
    "days-3": nth(salesDays, 3),
    "days-7": nth(salesDays, 7),
    "days-10": nth(salesDays, 10),
    "days-30": nth(salesDays, 30),
    "days-100": nth(salesDays, 100),
    "first-consult": minDate(src.contacts.filter(c => QUALIFIED.has(c.result)).map(c => c.date), today),
    "first-meeting": minDate(src.meetings.filter(m => m.상태 === "완료" || m.상태 === "계약").map(m => m.미팅날짜), today),
    "first-contract": nth(contractDates, 1),
    "first-payment": minDate(src.contracts.flatMap(c => [c.수납1, c.수납2, c.수납3, ...(c.추가진행 ?? [])]).filter(s => s && s.수납액 > 0).map(s => s.수납일), today),
    "contracts-5": nth(contractDates, 5),
    "first-db": minDate(src.dbTabDates, today),
    "first-dbsheet": minDate(src.leads.map(l => l.date), today),
    "first-contact": minDate(src.contacts.filter(c => !NOT_A_CONTACT.has(c.result)).map(c => c.date), today),
    "first-booking": minDate(src.meetings.map(m => m.예약일), today),
    "first-todo": minDate(src.todos.filter(t => !(t.type === "일반" && t.분류 === "기타")).map(t => kstDate(t.생성시각) || t.예정일자), today),
    "first-goal": valid(src.firstGoalOn, today) ? src.firstGoalOn : null,
    "push-on": valid(src.pushOnSince, today) ? src.pushOnSince : null,
    graduate: grad,
    "alumni-first": nth(alumniDays, 1),
    "alumni-30": nth(alumniDays, 30),
    "secret-grit": gritDay(src.contacts, today),
    "secret-fullday": fullDay(src, contractDates, today),
  };

  const progress: Record<string, BadgeProgress> = {
    "days-3": { cur: salesDays.length, max: 3, unit: "일" },
    "days-7": { cur: salesDays.length, max: 7, unit: "일" },
    "days-10": { cur: salesDays.length, max: 10, unit: "일" },
    "days-30": { cur: salesDays.length, max: 30, unit: "일" },
    "days-100": { cur: salesDays.length, max: 100, unit: "일" },
    "contracts-5": { cur: contractDates.length, max: 5, unit: "건" },
    "first-company": { cur: companyBest, max: 3, unit: "칸" },
  };
  if (grad) progress["alumni-30"] = { cur: alumniDays.length, max: 30, unit: "일" };

  return BADGES.map((b: BadgeDef): BadgeState => {
    if (!b.ready) return { id: b.id, earned: false, earnedOn: null, progress: null };
    if (b.id === "first-company") {
      const done = companyBest >= 3;
      return { id: b.id, earned: done, earnedOn: null, progress: done || companyBest === 0 ? null : progress[b.id]! };
    }
    const on = earnedOn[b.id] ?? null;
    const p = progress[b.id];
    return { id: b.id, earned: on !== null, earnedOn: on, progress: on === null && p && p.cur > 0 ? { ...p, cur: Math.min(p.cur, p.max) } : null };
  });
}
