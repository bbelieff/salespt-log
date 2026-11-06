/**
 * Layer: analytics(순수) — DB 시트 자동 확인(2026-11-06 belie, docs/plans/active/db-sheet-feed.md).
 * 연결된 공급처 구글시트를 매시간(07~21시) 읽어 「새 줄」만 고른다. 내려받기·저장은 서비스가 한다.
 *
 * 새 줄 판단(두 겹):
 *  ① 한 번 본 줄의 지문(fingerprint) — 전화번호 숫자 + 업체명·대표자 정규화 값의 해시만 기억한다(고객 원문 저장 안 함).
 *     수강생이 지운 DB 가 다음 확인 때 되살아나지 않는다.
 *  ② 목록·휴지통 중복(isSameLead) — 손으로 먼저 넣은 업체와 겹치면 넣지 않는다.
 * 애매한 줄(확인 질문이 있거나 필수 칸이 빈 줄)은 넣지도, 본 줄로 기억하지도 않는다 → 「확인 대기」로 센다.
 */
import { CompanyInfo } from "@/types";
import { companyKey, domesticPhoneDigits, isSameLead, type LeadIdentity } from "@/util/db-sheet-identity";
import { analyzeImport } from "./adaptive-import";
import { issues, type Row } from "./model";

/** 자동 확인 시각: 매일 07~21시 매시간 정각 한 번(belie 2026-11-06 「7-21시 매시간 한 번, 고르는 건 의미 없음」). */
export const FEED_FIRST_HOUR = 7;
export const FEED_LAST_HOUR = 21;
/** 한 번 확인에서 넣는 최대 건수 — 넘는 줄은 다음 시각에 이어서 넣는다. */
export const FEED_MAX_ADD = 200;
/** 연속 실패가 이만큼이면 일시정지(수강생이 「다시 켜기」). */
export const FEED_PAUSE_AFTER = 3;
/** 한 사람이 연결할 수 있는 시트 수. */
export const FEED_MAX_PER_PERSON = 3;

/** KST 기준 이번 확인 칸 — 「2026-11-06 13」. 07~21시 밖이면 null. */
export function feedSlot(now: Date): string | null {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  if (hour < FEED_FIRST_HOUR || hour > FEED_LAST_HOUR) return null;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}`;
}

function fnv(text: string, seed: number): string {
  let h = seed >>> 0;
  for (const ch of text) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
/** 줄 지문 — 같은 고객이면 시트에서 칸 순서·공백이 바뀌어도 같다. 원문을 되돌릴 수 없는 해시만 남긴다. */
export function feedFingerprint(row: Pick<Row, "phone" | "company" | "owner">): string {
  const key = `${domesticPhoneDigits(row.phone)}|${companyKey(row.company)}|${companyKey(row.owner)}`;
  return fnv(key, 2166136261) + fnv(key, 0x9e3779b9);
}

/** 화면 가져오기(db-sheet-store add)와 같은 모양의 저장 입력 — ContactPanel.contactDraft 와 같은 규칙. */
export function feedLeadInput(row: Row, today: string, inflow: boolean) {
  return {
    id: row.id, supplier: row.supplier, date: row.date, channel: row.channel,
    company: row.company, owner: row.owner, phone: row.phone, biz: row.biz, address: row.address, industry: row.industry,
    credit: row.credit, sales: row.sales, arrears: row.arrears, funds: row.funds, next: row.next || "", memo: row.memo,
    contact: {
      ci: CompanyInfo.parse({ 대표자이름: row.owner, 신용점수: row.credit, 업종주생산품목: row.industry, 소재지: row.address }),
      note: row.note ?? "", date: today, meetingDate: "", time: "", place: row.address, reservationNote: "", registered: false,
      companyName: row.company,
    },
    recording: { inflow, activities: true },
  };
}

export type FeedPlan = {
  /** 이번에 넣을 줄(최대 FEED_MAX_ADD). */
  add: Row[];
  /** 본 줄로 기억할 지문(넣는 줄 + 이미 있는 업체). */
  seen: string[];
  /** 확인 대기(애매해서 넣지 않은 줄) 수. */
  review: number;
  /** 다음 시각으로 미룬 수(FEED_MAX_ADD 초과). */
  deferred: number;
};

/** 제목행만 있고 고객이 아직 없는 시트는 빈 결과(오류 아님). 다른 형식 오류는 그대로 던진다. */
function analyzeFeed(text: string, rules: Record<number, string>) {
  try { return analyzeImport(text, "auto", rules as never).items; }
  catch (error) { if (text.split(/\r?\n/).filter((line) => line.replace(/[,\s]/g, "")).length <= 1) return []; throw error; }
}

/**
 * 내려받은 시트 글 → 이번에 넣을 새 줄. supplier·channel 은 연결할 때 확인한 값으로 덮는다(양식 추정보다 우선).
 * seen = 이미 본 지문, existing = 목록·휴지통 업체, today = KST 오늘(빈 유입일 채우기).
 */
export function planFeedRun(input: { text: string; rules: Record<number, string>; supplier: string; channel: string; today: string; seen: ReadonlySet<string>; existing: readonly LeadIdentity[] }): FeedPlan {
  const items = analyzeFeed(input.text, input.rules);
  const plan: FeedPlan = { add: [], seen: [], review: 0, deferred: 0 };
  const taken: LeadIdentity[] = [];
  for (const item of items) {
    // 날짜 칸이 빈 줄은 들어온 날(오늘)을 유입일로 — 가져오기 창의 「없는 유입일 채우기」와 같은 역할.
    const row: Row = { ...item.lead, supplier: input.supplier, channel: input.channel, date: item.lead.date || input.today };
    const fp = feedFingerprint(row);
    if (input.seen.has(fp)) continue;
    if (item.questions.length || issues(row)) { plan.review++; continue; }
    if (input.existing.some((e) => isSameLead(row, e)) || taken.some((e) => isSameLead(row, e))) { plan.seen.push(fp); continue; }
    if (plan.add.length >= FEED_MAX_ADD) { plan.deferred++; continue; }
    plan.add.push(row); plan.seen.push(fp); taken.push(row);
  }
  return plan;
}

/** 연결할 때: 지금 시트에 있는 줄은 모두 본 줄로(그때 수강생이 고른 것만 들어갔다). */
export function feedInitialSeen(text: string, rules: Record<number, string>): string[] {
  return analyzeFeed(text, rules).map((item) => feedFingerprint(item.lead));
}
