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
import type { DBBanner, DBLead, DBProduction, DBPurchase } from "@/types";

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
}

/** 4섹션 모두 한 번에 조회 (각 섹션 별 read = 4 sheet reads). */
export async function loadDBOverview(email: string): Promise<DBOverview> {
  const spreadsheetId = await resolveSheet(email);
  const [purchases, productions, banners, leads] = await Promise.all([
    readPurchases(spreadsheetId),
    readProductions(spreadsheetId),
    readBanners(spreadsheetId),
    readLeads(spreadsheetId),
  ]);
  return {
    purchases: purchases.rows,
    productions: productions.rows,
    banners: banners.rows,
    leads: leads.rows,
  };
}

// ── 매입DB ────────────────────────────────────────────────────
export async function addPurchase(email: string, p: DBPurchase) {
  return appendPurchase(await resolveSheet(email), p);
}
export async function patchPurchase(email: string, row: number, p: DBPurchase) {
  return updatePurchase(await resolveSheet(email), row, p);
}
export async function removePurchase(email: string, row: number) {
  return clearPurchase(await resolveSheet(email), row);
}

// ── 직접생산 ──────────────────────────────────────────────────
export async function addProduction(email: string, p: DBProduction) {
  return appendProduction(await resolveSheet(email), p);
}
export async function patchProduction(
  email: string,
  row: number,
  p: DBProduction,
) {
  return updateProduction(await resolveSheet(email), row, p);
}
export async function removeProduction(email: string, row: number) {
  return clearProduction(await resolveSheet(email), row);
}

// ── 현수막 ────────────────────────────────────────────────────
export async function addBanner(email: string, b: DBBanner) {
  return appendBanner(await resolveSheet(email), b);
}
export async function patchBanner(email: string, row: number, b: DBBanner) {
  return updateBanner(await resolveSheet(email), row, b);
}
export async function removeBanner(email: string, row: number) {
  return clearBanner(await resolveSheet(email), row);
}

// ── 콜·지·기·소 ────────────────────────────────────────────────
export async function addLead(email: string, l: DBLead) {
  return appendLead(await resolveSheet(email), l);
}
export async function patchLead(email: string, row: number, l: DBLead) {
  return updateLead(await resolveSheet(email), row, l);
}
export async function removeLead(email: string, row: number) {
  return clearLead(await resolveSheet(email), row);
}
