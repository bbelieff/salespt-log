/**
 * Layer: service — DB관리 탭 유스케이스 (PR 09).
 *
 * 4채널 raw 입력 read/write. 합계·평균단가 계산은 시트 수식이 처리.
 */
import { findUserByEmail } from "@/repo/users";
import {
  appendBanner,
  appendLead,
  appendProduction,
  appendPurchase,
  clearBanner,
  clearLead,
  clearProduction,
  clearPurchase,
  readBanners,
  readLeads,
  readProductions,
  readPurchases,
  updateBanner,
  updateLead,
  updateProduction,
  updatePurchase,
} from "@/repo/db";
import {
  appendBannerPost,
  clearBannerPost,
  readBannerPosts,
  updateBannerPost,
} from "@/repo/banner-post";
import { writeProductionCell } from "@/repo/sales";
import type {
  Channel,
  DBBanner,
  DBBannerPost,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[db] 등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
}

export interface DBOverview {
  purchases: Array<DBPurchase & { row: number }>;
  productions: Array<DBProduction & { row: number }>;
  banners: Array<DBBanner & { row: number }>;
  leads: Array<DBLead & { row: number }>;
  bannerPosts: Array<DBBannerPost & { row: number }>; // 현수막 게시 로그(AF:AI)
}

/** 5섹션 한 번에 조회 (각 섹션 read = sheet read). */
export async function loadDBOverview(email: string): Promise<DBOverview> {
  const spreadsheetId = await resolveSheet(email);
  const [purchases, productions, banners, leads, bannerPosts] = await Promise.all([
    readPurchases(spreadsheetId),
    readProductions(spreadsheetId),
    readBanners(spreadsheetId),
    readLeads(spreadsheetId),
    readBannerPosts(spreadsheetId),
  ]);
  return {
    purchases: purchases.rows,
    productions: productions.rows,
    banners: banners.rows,
    leads: leads.rows,
    bannerPosts: bannerPosts.rows,
  };
}

// ── 생산(E) 집계쓰기 (PR1 / ADR-0020) ──────────────────────────
// DB raw 변경 시 그 (채널, 날짜)의 생산수를 재집계해 01 영업관리 E 에 기입.
// 매입DB/직접생산/현수막 = Σ개수, 콜·지·기·소 = 행수(개수 필드 없음).

/** (채널 raw rows, 날짜) → 그 날짜 생산수. 순수 — 단위 테스트 대상. */
export function productionCountFor(
  channel: Channel,
  rows: {
    구매일?: string;
    종료일?: string;
    게시일?: string;
    접수일?: string;
    주문개수?: number;
    생산개수?: number;
    게시수?: number;
  }[],
  date: string,
): number {
  if (!date) return 0;
  if (channel === "매입DB")
    return rows.filter((r) => r.구매일 === date).reduce((s, r) => s + (r.주문개수 || 0), 0);
  if (channel === "직접생산")
    // 종료일 == date 이고 생산개수 채워진(완료) 행만 — 생산중(빈)은 미반영.
    return rows
      .filter((r) => r.종료일 === date && (r.생산개수 || 0) > 0)
      .reduce((s, r) => s + (r.생산개수 || 0), 0);
  if (channel === "현수막")
    // 게시 로그 기준: 게시일 == date 의 Σ게시수 (주문/발주일 아님 — ADR-0023).
    return rows.filter((r) => r.게시일 === date).reduce((s, r) => s + (r.게시수 || 0), 0);
  return rows.filter((r) => r.접수일 === date).length; // 콜·지·기·소
}

async function readChannelRows(spreadsheetId: string, channel: Channel) {
  if (channel === "매입DB") return (await readPurchases(spreadsheetId)).rows;
  if (channel === "직접생산") return (await readProductions(spreadsheetId)).rows;
  if (channel === "현수막") return (await readBannerPosts(spreadsheetId)).rows; // 생산 E = 게시 로그
  return (await readLeads(spreadsheetId)).rows;
}

/** raw 행에서 그 (채널, 날짜)의 날짜 필드 값 (patch/remove 의 옛 날짜 식별용). */
function dateOfRow(channel: Channel, row: DBPurchase | DBProduction | DBBanner | DBLead): string {
  if (channel === "매입DB") return (row as DBPurchase).구매일;
  if (channel === "콜·지·기·소") return (row as DBLead).접수일;
  if (channel === "직접생산") return (row as DBProduction).종료일; // 집계 기준 = 종료일
  return (row as DBBanner).날짜; // 현수막
}

/** DB 변경 후 그 (채널, 날짜) 생산(E) 재집계·기입. 실패해도 DB 저장은 성공(warn). */
async function syncProduction(spreadsheetId: string, channel: Channel, date: string) {
  if (!date) return;
  try {
    const rows = await readChannelRows(spreadsheetId, channel);
    await writeProductionCell(spreadsheetId, date, channel, productionCountFor(channel, rows, date));
  } catch (e) {
    console.warn(`[db] 생산 집계 기입 실패 (${channel} ${date}):`, e instanceof Error ? e.message : e);
  }
}

/** patch/remove 전 해당 row 의 옛 날짜 읽기 (날짜 변경·삭제 시 옛 날짜 E 재집계용). */
async function oldDateOf(spreadsheetId: string, channel: Channel, row: number): Promise<string> {
  const rows = await readChannelRows(spreadsheetId, channel);
  const hit = (rows as Array<{ row: number }>).find((r) => r.row === row);
  return hit ? dateOfRow(channel, hit as never) : "";
}

// ── 매입DB ────────────────────────────────────────────────────
export async function addPurchase(email: string, p: DBPurchase) {
  const sid = await resolveSheet(email);
  const r = await appendPurchase(sid, p);
  await syncProduction(sid, "매입DB", p.구매일);
  return r;
}
export async function patchPurchase(email: string, row: number, p: DBPurchase) {
  const sid = await resolveSheet(email);
  const old = await oldDateOf(sid, "매입DB", row);
  const r = await updatePurchase(sid, row, p);
  await syncProduction(sid, "매입DB", old);
  if (p.구매일 !== old) await syncProduction(sid, "매입DB", p.구매일);
  return r;
}
export async function removePurchase(email: string, row: number) {
  const sid = await resolveSheet(email);
  const old = await oldDateOf(sid, "매입DB", row);
  const r = await clearPurchase(sid, row);
  await syncProduction(sid, "매입DB", old);
  return r;
}

// ── 직접생산 ──────────────────────────────────────────────────
export async function addProduction(email: string, p: DBProduction) {
  const sid = await resolveSheet(email);
  const r = await appendProduction(sid, p);
  await syncProduction(sid, "직접생산", p.종료일); // 종료일 기준
  return r;
}
export async function patchProduction(email: string, row: number, p: DBProduction) {
  const sid = await resolveSheet(email);
  const old = await oldDateOf(sid, "직접생산", row); // 옛 종료일
  const r = await updateProduction(sid, row, p);
  await syncProduction(sid, "직접생산", old);
  if (p.종료일 !== old) await syncProduction(sid, "직접생산", p.종료일);
  return r;
}
export async function removeProduction(email: string, row: number) {
  const sid = await resolveSheet(email);
  const old = await oldDateOf(sid, "직접생산", row);
  const r = await clearProduction(sid, row);
  await syncProduction(sid, "직접생산", old);
  return r;
}

// ── 현수막 주문 (P:V) ─────────────────────────────────────────
// 주문은 생산 E 를 만들지 않는다(생산=게시 로그). 비용(주문금액)만 대시보드에 반영.
export async function addBanner(email: string, b: DBBanner) {
  const sid = await resolveSheet(email);
  return appendBanner(sid, b);
}
export async function patchBanner(email: string, row: number, b: DBBanner) {
  const sid = await resolveSheet(email);
  return updateBanner(sid, row, b);
}
export async function removeBanner(email: string, row: number) {
  const sid = await resolveSheet(email);
  return clearBanner(sid, row);
}

// ── 현수막 게시 로그 (AF:AI, 1:N) — 생산 E = 게시일 Σ게시수 ──────
function genPostId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p${Date.now()}`;
  }
}
async function oldPostDate(sid: string, row: number): Promise<string> {
  const rows = (await readBannerPosts(sid)).rows;
  return rows.find((r) => r.row === row)?.게시일 ?? "";
}
export async function addBannerPost(email: string, p: DBBannerPost) {
  const sid = await resolveSheet(email);
  const r = await appendBannerPost(sid, { ...p, 게시id: p.게시id || genPostId() });
  await syncProduction(sid, "현수막", p.게시일);
  return r;
}
export async function patchBannerPost(email: string, row: number, p: DBBannerPost) {
  const sid = await resolveSheet(email);
  const old = await oldPostDate(sid, row);
  const r = await updateBannerPost(sid, row, p);
  await syncProduction(sid, "현수막", old);
  if (p.게시일 !== old) await syncProduction(sid, "현수막", p.게시일);
  return r;
}
export async function removeBannerPost(email: string, row: number) {
  const sid = await resolveSheet(email);
  const old = await oldPostDate(sid, row);
  const r = await clearBannerPost(sid, row);
  await syncProduction(sid, "현수막", old);
  return r;
}

// ── 콜·지·기·소 ────────────────────────────────────────────────
export async function addLead(email: string, l: DBLead) {
  const sid = await resolveSheet(email);
  const r = await appendLead(sid, l);
  await syncProduction(sid, "콜·지·기·소", l.접수일);
  return r;
}
export async function patchLead(email: string, row: number, l: DBLead) {
  const sid = await resolveSheet(email);
  const old = await oldDateOf(sid, "콜·지·기·소", row);
  const r = await updateLead(sid, row, l);
  await syncProduction(sid, "콜·지·기·소", old);
  if (l.접수일 !== old) await syncProduction(sid, "콜·지·기·소", l.접수일);
  return r;
}
export async function removeLead(email: string, row: number) {
  const sid = await resolveSheet(email);
  const old = await oldDateOf(sid, "콜·지·기·소", row);
  const r = await clearLead(sid, row);
  await syncProduction(sid, "콜·지·기·소", old);
  return r;
}
