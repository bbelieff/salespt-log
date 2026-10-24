/**
 * Pure push copy (plan §3-1·§3-3). One notification names the single most pressing item
 * plus the total, in the order `followUpHeadline()` uses. Nothing here scolds or compares.
 */
import { TODAY_MEETING_REASON, meetingResultDue, type FollowUpItem, type FollowUpSummary } from "@/lib/analytics/dashboard-follow-ups";
import type { Meeting } from "@/types";
import type { PushContentKind, PushPreferences } from "@/types/push";
import { addDaysISO, type DispatchSlot } from "./push-schedule";

export interface PushMessage { messageId: string; body: string; url: string; itemCount: number }

type FollowUpContentKind = Exclude<PushContentKind, "seed">;
const PRIORITY: readonly FollowUpContentKind[] = ["overdue", "meeting", "today", "initial", "recontact", "stalled"];

/** Future todos carry kind "upcoming"; for settings they belong to 「오늘 할 일」. */
export function contentKindOf(item: FollowUpItem): FollowUpContentKind {
  return item.kind === "upcoming" ? "today" : item.kind;
}

/** 당일·아직 끝나지 않은 미팅 — 결과를 묻지 않고 오늘 미팅이 있다고만 알린다. */
const isTodayMeeting = (it: FollowUpItem) => it.reasons.includes(TODAY_MEETING_REASON);
const clip = (s: string, n = 24) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

type Copy = (it: FollowUpItem, n: number) => string;
/** [shown company, hidden company] per variant. */
const MORNING: Record<FollowUpContentKind, Array<[Copy, Copy]>> = {
  overdue: [
    [it => `${clip(it.title)} 「${clip(it.action, 16)}」 하기로 한 건 연락해 보셨어요?`, (_, n) => `밀린 약속 ${n}건이 있어요. 하나만 먼저 정리해 볼까요?`],
    [it => `${clip(it.title)} 약속이 기한을 지났어요. 오늘 하나만 챙겨 볼까요?`, (_, n) => `기한이 지난 약속이 ${n}건 있어요. 오늘 하나만 챙겨 볼까요?`],
  ],
  meeting: [
    [it => isTodayMeeting(it) ? `오늘 ${clip(it.title)} 미팅이 있어요. 끝나면 결과를 적어 두세요.` : it.overdueDays === 0 ? `오늘 ${clip(it.title)} 미팅은 어떻게 됐어요?` : `${clip(it.title)} 미팅은 어떻게 됐어요?`,
      (it, n) => isTodayMeeting(it) ? "오늘 미팅이 있어요. 끝나면 결과를 적어 두세요." : `미팅 결과가 ${n}건 비어 있어요. 어떻게 됐는지 적어 둘까요?`],
    [it => isTodayMeeting(it) ? `오늘 ${clip(it.title)} 미팅, 준비는 잘 되셨어요?` : `${clip(it.title)} 미팅 결과를 남겨 두면 다음 연락이 쉬워져요.`,
      (it, n) => isTodayMeeting(it) ? "오늘 미팅이 있어요. 잘 다녀오세요." : `결과를 기다리는 미팅이 ${n}건 있어요.`],
  ],
  today: [
    [it => `오늘 ${clip(it.title)} 「${clip(it.action, 16)}」 하기로 하셨어요.`, (_, n) => `오늘 하기로 한 일이 ${n}건 있어요.`],
    [it => `오늘 할 일: ${clip(it.title)} 「${clip(it.action, 16)}」`, (_, n) => `오늘 할 일 ${n}건, 하나씩 끝내 봐요.`],
  ],
  initial: [
    [it => `새 DB ${clip(it.title)}에 첫 연락 해 보셨어요?`, (_, n) => `아직 첫 연락 전인 DB가 ${n}곳 있어요.`],
    [it => `${clip(it.title)} 첫 통화, 오늘 걸어 볼까요?`, (_, n) => `첫 연락을 기다리는 DB가 ${n}곳 있어요.`],
  ],
  recontact: [
    [it => `${clip(it.title)} 요즘 어때요? 다시 연락할 때가 됐어요.`, (_, n) => `다시 연락할 때가 된 업체가 ${n}곳 있어요.`],
    [it => `${clip(it.title)}에 다시 연락해 볼 날이에요.`, (_, n) => `다시 연락해 볼 업체가 ${n}곳 있어요.`],
  ],
  stalled: [
    [it => `${clip(it.title)} 다음 할 일이 비어 있어요.`, (_, n) => `다음 진행을 정할 건이 ${n}건 있어요.`],
    [it => `${clip(it.title)} 진행이 멈춰 있어요. 다음 할 일을 정해 볼까요?`, (_, n) => `멈춰 있는 진행건이 ${n}건 있어요.`],
  ],
};

function pickVariant(prefix: string, count: number, recent: readonly string[]): number {
  for (let i = 0; i < count; i++) if (!recent.includes(`${prefix}.v${i + 1}`)) return i;
  return 0;
}

function choose(items: FollowUpItem[]): { kind: FollowUpContentKind; item: FollowUpItem; sameKind: number } | null {
  for (const kind of PRIORITY) {
    const of = items.filter(i => contentKindOf(i) === kind);
    if (of.length) return { kind, item: of[0]!, sameKind: of.length };
  }
  return null;
}

const tail = (total: number) => (total > 1 ? ` · 전체 ${total}건` : "");

/** Null = nothing to say; the dispatcher then sends nothing at all (no silent pushes). */
export function buildPushMessage(slot: DispatchSlot, summary: Pick<FollowUpSummary, "items" | "urgent">, prefs: Pick<PushPreferences, "kinds" | "showCompanyNames">, today: string, recent: readonly string[] = []): PushMessage | null {
  const allowed = (i: FollowUpItem) => prefs.kinds.includes(contentKindOf(i));
  const urgent = summary.urgent.filter(allowed);
  const show = prefs.showCompanyNames;
  if (slot === "evening") {
    const tomorrow = addDaysISO(today, 1);
    const next = summary.items.filter(i => allowed(i) && i.dueISO === tomorrow);
    const pick = choose(next);
    if (pick) {
      const { item } = pick;
      const body = show
        ? (contentKindOf(item) === "meeting" ? `내일 ${clip(item.title)} 미팅이 있어요. 준비됐나요?` : `내일 ${clip(item.title)} 「${clip(item.action, 16)}」 하기로 하셨어요. 준비됐나요?`)
        : `내일 하기로 한 일이 ${next.length}건 있어요.`;
      return { messageId: `evening.tomorrow.v1`, body: body + (show ? tail(next.length) : ""), url: show ? item.href : "/dashboard", itemCount: next.length };
    }
    const left = choose(urgent);
    if (!left) return null;
    const body = !show ? `오늘 남은 일이 ${urgent.length}건 있어요. 하나만 정리하고 마무리해요.`
      : isTodayMeeting(left.item) ? `오늘 ${clip(left.item.title)} 미팅, 끝나면 결과를 적어 두세요.`
      : `${clip(left.item.title)} 「${clip(left.item.action, 16)}」 오늘 마무리해 볼까요?`;
    return { messageId: `evening.left.v1`, body: body + (show ? tail(urgent.length) : ""), url: show ? left.item.href : "/dashboard", itemCount: urgent.length };
  }
  const pick = choose(urgent);
  if (!pick) return null;
  const variants = MORNING[pick.kind];
  const prefix = `morning.${pick.kind}`;
  const v = pickVariant(prefix, variants.length, recent);
  const [shown, hidden] = variants[v]!;
  const body = show ? shown(pick.item, pick.sameKind) + tail(urgent.length) : hidden(pick.item, pick.sameKind) + (urgent.length > pick.sameKind ? tail(urgent.length) : "");
  return { messageId: `${prefix}.v${v + 1}`, body, url: show ? pick.item.href : "/dashboard", itemCount: urgent.length };
}

/** Adds the delivery tag the service worker reports back when the notification is tapped. */
export function withDeliveryTag(url: string, deliveryId: string): string {
  const safe = url.startsWith("/") && !url.startsWith("//") ? url : "/dashboard";
  return `${safe}${safe.includes("?") ? "&" : "?"}from=push&d=${encodeURIComponent(deliveryId)}`;
}

/** 미팅 끝 결과 알림은 이 시각까지만 — 늦은 밤 미팅은 다음 날 아침 알림이 결과를 묻는다. */
export const MEETING_RESULT_PUSH_UNTIL = "21:00";
/**
 * 오늘 미팅 중 지금 결과를 물을 때가 된 것(시작 3시간 뒤, belie 2026-10-25) — 아직 「예약」(결과 미입력)인 것만.
 * 시간 순서대로; 발송 쪽이 미팅마다 한 번만 보낸다.
 */
export function dueMeetingResults(meetings: readonly Meeting[], today: string, nowHHMM: string): Meeting[] {
  if (nowHHMM > MEETING_RESULT_PUSH_UNTIL) return [];
  return meetings
    .filter(m => m.상태 === "예약" && m.미팅날짜 === today && meetingResultDue(m.미팅날짜, m.미팅시간, today, nowHHMM))
    .sort((a, b) => a.미팅시간.localeCompare(b.미팅시간));
}
export function buildMeetingResultMessage(m: Meeting, showCompanyNames: boolean): PushMessage {
  const body = showCompanyNames
    ? `${clip(m.업체명.replace(/^\(변경\)\s*/, ""))} 미팅은 어떻게 됐어요? 결과를 적어 두면 다음 연락이 쉬워져요.`
    : "오늘 미팅은 어떻게 됐어요? 결과를 적어 두면 다음 연락이 쉬워져요.";
  return { messageId: "meeting.result.v1", body, url: showCompanyNames ? `/schedule?date=${m.미팅날짜}&focus=${encodeURIComponent(m.id)}` : "/schedule", itemCount: 1 };
}
