/**
 * Layer: service — DB 시트 자동 확인(2026-11-06 belie, docs/plans/active/db-sheet-feed.md).
 * 수강생이 연결한 공급처 구글시트를 07~21시 매시간 읽어 새 줄만 DB관리시트에 넣는다.
 * 들어간 DB는 유입 기록 「반영 안 함」으로 넣고, 수강생이 DB관리시트를 열 때 팝업에서 반영할지 고른다.
 * 내려받기는 가져오기와 같은 길(fetchGoogleSheetCsv — docs.google.com 공유 주소만), 저장은 화면 가져오기와 같은 import 명령.
 */
import * as Sentry from "@sentry/nextjs";
import { randomUUID } from "node:crypto";
import { fetchGoogleSheetCsv, GoogleSheetImportError } from "@/repo/google-sheet-export";
import * as feeds from "@/repo/db/db-sheet-feeds";
import * as ledger from "@/repo/db/db-sheet";
import { parseGoogleSheetUrl } from "@/util/google-sheet-url";
import { todayKST } from "@/util/week";
import { DbSheetLeadInput, type DbSheetContext } from "@/types/db-sheet";
import { CHANNEL_ORDER } from "@/types/channel";
import { FEED_MAX_PER_PERSON, FEED_PAUSE_AFTER, feedInitialSeen, feedLeadInput, feedSlot, planFeedRun } from "@/lib/analytics/db-import/feed";
import { executeDbSheet, resolveDbSheetContext, DbSheetUnavailable } from "./db-sheet";
import { sendDbFeedPush } from "./push";

export class DbSheetFeedError extends Error {}

export type DbSheetFeedView = {
  id: string; supplier: string; channel: string; sheetUrl: string; enabled: boolean;
  lastCheckedAt: string | null; lastAdded: number; reviewCount: number; lastError: string | null; pendingInflow: string[];
};
const sheetUrl = (f: feeds.DbSheetFeedRow) => `https://docs.google.com/spreadsheets/d/${f.sheetId}/edit${f.gid ? `#gid=${f.gid}` : ""}`;
const view = (f: feeds.DbSheetFeedRow): DbSheetFeedView => ({
  id: f.id, supplier: f.supplier, channel: f.channel, sheetUrl: sheetUrl(f), enabled: f.enabled,
  lastCheckedAt: f.lastCheckedAt, lastAdded: f.lastAdded, reviewCount: f.reviewCount, lastError: f.lastError, pendingInflow: f.pendingInflow,
});

export async function listDbSheetFeeds(ctx: DbSheetContext): Promise<DbSheetFeedView[]> {
  return (await feeds.listFeedsForSheet(ctx.spreadsheetId)).map(view);
}

/** 가져오기 확인 화면에서 「자동 확인」을 켜고 추가했을 때. 지금 시트에 있는 줄은 모두 본 줄로 기억한다. */
export async function connectDbSheetFeed(ctx: DbSheetContext, input: { url: string; supplier: string; channel: string; rules: Record<string, string> }): Promise<DbSheetFeedView> {
  const ref = parseGoogleSheetUrl(input.url);
  if (!ref) throw new DbSheetFeedError("구글시트 공유 주소만 연결할 수 있어요.");
  const supplier = input.supplier.trim();
  if (!supplier) throw new DbSheetFeedError("공급처를 적은 뒤 연결해 주세요.");
  if (!(CHANNEL_ORDER as readonly string[]).includes(input.channel)) throw new DbSheetFeedError("유형을 고른 뒤 연결해 주세요.");
  const existing = await feeds.listFeedsForSheet(ctx.spreadsheetId);
  const same = existing.some((f) => f.sheetId === ref.id && f.gid === (ref.gid ?? ""));
  if (!same && existing.length >= FEED_MAX_PER_PERSON) throw new DbSheetFeedError(`시트는 ${FEED_MAX_PER_PERSON}개까지 연결할 수 있어요. 안 쓰는 연결을 해제해 주세요.`);
  const text = await fetchGoogleSheetCsv(input.url);
  const rules = Object.fromEntries(Object.entries(input.rules).filter(([k, v]) => /^\d{1,3}$/.test(k) && typeof v === "string" && v.length <= 20));
  const row = await feeds.upsertFeed({ email: ctx.email, spreadsheetId: ctx.spreadsheetId, sheetId: ref.id, gid: ref.gid ?? "", supplier: supplier.slice(0, 100), channel: input.channel, rules, seen: feedInitialSeen(text, rules) });
  return view(row);
}

export type FeedRunResult = { added: number; review: number };
/** 연결 하나 확인: 내려받기 → 새 줄 고르기 → 같은 import 명령으로 저장(유입 반영 안 함) → 기록. */
async function runFeed(ctx: DbSheetContext, feed: feeds.DbSheetFeedRow, now: Date): Promise<FeedRunResult> {
  const text = await fetchGoogleSheetCsv(sheetUrl(feed));
  const [leads, trash] = await Promise.all([ledger.listDbSheet(ctx), ledger.listDbSheetTrash(ctx)]);
  const existing = [...leads.map((l) => ({ company: l.company, phone: l.phone, biz: l.biz })), ...trash.map((t) => ({ company: t.company, phone: t.phone, biz: "" }))];
  const today = todayKST(now);
  const plan = planFeedRun({ text, rules: feed.rules as Record<number, string>, supplier: feed.supplier, channel: feed.channel, today, seen: new Set(feed.seen), existing });
  let added: string[] = [];
  if (plan.add.length) {
    const inputs = plan.add.map((row) => DbSheetLeadInput.parse(feedLeadInput(row, today, false)));
    const result = await executeDbSheet(ctx, { action: "import", batchId: randomUUID(), leads: inputs });
    added = result.leads.map((l) => l.id);
  }
  await feeds.recordFeedSuccess(feed.id, { seen: plan.seen, added, review: plan.review + plan.deferred });
  return { added: added.length, review: plan.review };
}

function failureMessage(error: unknown): string {
  if (error instanceof GoogleSheetImportError) return error.message;
  if (error instanceof DbSheetUnavailable) return "DB관리시트를 쓸 수 없는 계정이에요.";
  return "확인하지 못했어요. 다음 시각에 다시 확인해요.";
}

/** 「지금 확인」 — 시각과 관계없이 바로 한 번. */
export async function checkDbSheetFeedNow(ctx: DbSheetContext, id: string): Promise<FeedRunResult> {
  const feed = (await feeds.listFeedsForSheet(ctx.spreadsheetId)).find((f) => f.id === id);
  if (!feed) throw new DbSheetFeedError("연결을 찾지 못했어요.");
  try {
    return await runFeed(ctx, feed, new Date());
  } catch (error) {
    await feeds.recordFeedFailure(feed.id, failureMessage(error), Number.MAX_SAFE_INTEGER);
    throw new DbSheetFeedError(failureMessage(error));
  }
}

export async function setDbSheetFeedEnabled(ctx: DbSheetContext, id: string, enabled: boolean) {
  if (!(await feeds.setFeedEnabled(ctx.spreadsheetId, id, enabled))) throw new DbSheetFeedError("연결을 찾지 못했어요.");
}
export async function removeDbSheetFeed(ctx: DbSheetContext, id: string) {
  if (!(await feeds.deleteFeed(ctx.spreadsheetId, id))) throw new DbSheetFeedError("연결을 찾지 못했어요.");
}
/** 유입 반영 팝업에 답한 DB(반영·반영 안 함 모두)를 묻는 목록에서 뺀다. 반영 자체는 화면이 기존 inflow 명령으로 한다. */
export async function answerDbSheetFeedInflow(ctx: DbSheetContext, ids: string[]) {
  await feeds.clearPendingInflow(ctx.spreadsheetId, ids);
}

export type FeedDispatchStats = { slot: string | null; due: number; checked: number; added: number; failed: number; left: number };
/** 서버 시계(15분)마다 불린다. 시각 칸마다 연결 하나를 한 번만 확인하고, 시간이 모자라면 다음 15분에 이어서. */
export async function dispatchDbSheetFeeds(now = new Date(), budgetMs = 25_000): Promise<FeedDispatchStats> {
  const slot = feedSlot(now);
  const stats: FeedDispatchStats = { slot, due: 0, checked: 0, added: 0, failed: 0, left: 0 };
  if (!slot || process.env.DB_FEED_ENABLED === "0") return stats;
  const due = await feeds.listDueFeeds(slot);
  stats.due = due.length;
  const deadline = Date.now() + budgetMs;
  const addedByEmail = new Map<string, number>();
  let next = 0;
  const worker = async () => {
    while (next < due.length && Date.now() < deadline) {
      const feed = due[next++]!;
      if (!(await feeds.claimFeedSlot(feed.id, slot))) continue;
      try {
        const ctx = await resolveDbSheetContext(feed.email);
        if (ctx.spreadsheetId !== feed.spreadsheetId) throw new DbSheetUnavailable("sheet_changed");
        const r = await runFeed(ctx, feed, now);
        stats.checked++; stats.added += r.added;
        if (r.added) addedByEmail.set(feed.email, (addedByEmail.get(feed.email) ?? 0) + r.added);
      } catch (error) {
        stats.failed++;
        await feeds.recordFeedFailure(feed.id, failureMessage(error), FEED_PAUSE_AFTER).catch(() => {});
        if (!(error instanceof GoogleSheetImportError)) Sentry.captureException(error, { tags: { where: "db-sheet-feed" } });
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  stats.left = Math.max(0, due.length - next);
  for (const [email, added] of addedByEmail) {
    await sendDbFeedPush(email, added, slot, now).catch((error) => Sentry.captureException(error, { tags: { where: "db-sheet-feed-push" } }));
  }
  return stats;
}
