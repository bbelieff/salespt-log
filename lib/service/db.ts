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
  writeProductionCountCell,
} from "@/repo/db";
import * as Sentry from "@sentry/nextjs";
import { dbEnabled } from "@/repo/db/client";
import { readDbTabFromDb } from "@/repo/db/read-db-tab";
import { chooseDailySource } from "./daily-source";
import { writeProductionCell, sumChannelInflowOverPeriod } from "@/repo/sales";
import type {
  Channel,
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[db] 등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
}

/** sid + 쓰기 정본 여부(파일럿+DB) — 직접생산 M 의 유입 합산을 DB/시트 중 어디서 할지 판정(R3-1). */
async function resolveWriteCtx(email: string): Promise<{ sid: string; fromDb: boolean }> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[db] 등록되지 않은 사용자: ${email}`);
  return { sid: user.spreadsheetId, fromDb: chooseDailySource(user.cohort, dbEnabled()) === "db" };
}

export interface DBOverview {
  purchases: Array<DBPurchase & { row: number }>;
  productions: Array<DBProduction & { row: number }>;
  banners: Array<DBBanner & { row: number }>;
  leads: Array<DBLead & { row: number }>;
}

/** 섹션 read 실패 시 빈 배열로 강등(나머지 채널은 정상 표시) + 경고 로그. */
function rowsOrEmpty<T>(r: PromiseSettledResult<{ rows: T[] }>, label: string): T[] {
  if (r.status === "fulfilled") return r.value.rows;
  console.warn(
    `[db] ${label} read 실패 — 빈 목록으로 강등:`,
    r.reason instanceof Error ? r.reason.message : r.reason,
  );
  return [];
}

/**
 * 5섹션 한 번에 조회. allSettled — 한 섹션(예: 신규 AF:AI 게시로그)만 throw 해도
 * 그 채널만 빈 목록, 나머지는 정상. resolveSheet(사용자 없음)만 throw 유지.
 *
 * R2-5(db-read-production): 파일럿 기수는 4섹션 시트 read(4회) → DB 단일 쿼리.
 * 실패 시 기존 시트 경로 silent fallback + Sentry(화면 에러 금지). 비파일럿 불변.
 */
export async function loadDBOverview(email: string): Promise<DBOverview> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[db] 등록되지 않은 사용자: ${email}`);
  const spreadsheetId = user.spreadsheetId;

  if (chooseDailySource(user.cohort, dbEnabled()) === "db") {
    try {
      return await readDbTabFromDb(spreadsheetId);
    } catch (e) {
      Sentry.captureException(e, { tags: { where: "loadDBOverview-db-read" } });
      // ↓ 시트 경로로 silent fallback
    }
  }

  const [purchases, productions, banners, leads] = await Promise.allSettled([
    readPurchases(spreadsheetId),
    readProductions(spreadsheetId),
    readBanners(spreadsheetId),
    readLeads(spreadsheetId),
  ]);
  return {
    purchases: rowsOrEmpty(purchases, "매입DB"),
    productions: rowsOrEmpty(productions, "직접생산"),
    banners: rowsOrEmpty(banners, "현수막"),
    leads: rowsOrEmpty(leads, "콜·지·기·소"),
  };
}

// ── 생산(E) 집계쓰기 (ADR-0020) — 매입DB·콜·지·기·소 한정 ────────
// DB raw 변경 시 그 (채널, 날짜)의 생산수를 재집계해 01 영업관리 E 에 기입.
// 직접생산(ADR-0024)·현수막(ADR-0025)은 컨택이 E 소유 → 여기서 집계 안 함.

/** (채널 raw rows, 날짜) → 그 날짜 생산수. 순수 — 단위 테스트 대상. */
export function productionCountFor(
  channel: Channel,
  rows: {
    구매일?: string;
    종료일?: string;
    접수일?: string;
    주문개수?: number;
    생산개수?: number;
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
  return rows.filter((r) => r.접수일 === date).length; // 콜·지·기·소
}

async function readChannelRows(spreadsheetId: string, channel: Channel) {
  if (channel === "매입DB") return (await readPurchases(spreadsheetId)).rows;
  if (channel === "직접생산") return (await readProductions(spreadsheetId)).rows;
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

// ── 직접생산 (생산 = 유입, ADR-0024) ──────────────────────────
// 생산개수(M)는 유입 기간합 자동 동기화 — DB집계 syncProduction 미사용. 기간 겹침 금지(활성 레코드 유일).

/** 두 기간 [aS,aE]·[bS,bE] 겹침 (ISO 비교, 빈값은 비겹침). 단위 테스트 대상(ADR-0024). */
export function periodsOverlap(aS: string, aE: string, bS: string, bE: string): boolean {
  if (!aS || !aE || !bS || !bE) return false;
  return aS <= bE && bS <= aE;
}

/** 직접생산 추가/수정 시 기존 레코드와 기간 겹치면 throw (활성 레코드 유일성, ADR-0024). */
async function assertNoOverlapDirect(
  sid: string,
  start: string,
  end: string,
  excludeRow?: number,
): Promise<void> {
  if (!start || !end) throw new Error("직접생산: 시작일·종료일을 모두 입력해주세요.");
  if (start > end) throw new Error("직접생산: 시작일이 종료일보다 늦습니다.");
  const { rows } = await readProductions(sid);
  for (const r of rows) {
    if (r.row === excludeRow) continue;
    if (periodsOverlap(start, end, r.시작일, r.종료일))
      throw new Error(
        `직접생산 기간이 겹쳐요: 기존 ${r.시작일}~${r.종료일}(${r.소재 || "소재없음"})와 겹치지 않게 입력해주세요.`,
      );
  }
}

/** 직접생산 레코드 R 의 M = Σ(영업관리 F 직접생산, R 기간) 동기화 (M 셀만 update).
 *  fromDb(R3-1): 쓰기 정본이 DB 인 파일럿이면 유입 합산을 DB 에서(시트 미러 지연/실패 무관·정확). */
async function syncDirectCount(
  sid: string,
  record: { row: number; 시작일: string; 종료일: string },
  fromDb: boolean,
): Promise<number> {
  const count = await sumChannelInflowOverPeriod(sid, "직접생산", record.시작일, record.종료일, { fromDb });
  await writeProductionCountCell(sid, record.row, count);
  return count;
}

/** 컨택 유입 저장 후 그 날짜를 포함하는 활성 직접생산 레코드 M 동기화 (ADR-0024).
 *  활성 레코드 없으면 recordFound=false → 호출측(컨택)이 보류 모달.
 *  cohort: 쓰기 정본 판정용(파일럿+DB → 유입 합산 DB 정본, R3-1). */
export async function syncDirectProductionForDate(
  sid: string,
  date: string,
  cohort: string | null | undefined,
): Promise<{ recordFound: boolean; count: number }> {
  const { rows } = await readProductions(sid);
  const active = rows.find(
    (r) => r.시작일 && r.종료일 && r.시작일 <= date && date <= r.종료일,
  );
  if (!active) return { recordFound: false, count: 0 };
  const count = await syncDirectCount(sid, active, chooseDailySource(cohort, dbEnabled()) === "db");
  return { recordFound: true, count };
}

export async function addProduction(email: string, p: DBProduction) {
  const { sid, fromDb } = await resolveWriteCtx(email);
  await assertNoOverlapDirect(sid, p.시작일, p.종료일);
  const r = await appendProduction(sid, p);
  await syncDirectCount(sid, { row: r.row, 시작일: p.시작일, 종료일: p.종료일 }, fromDb);
  return r;
}
export async function patchProduction(email: string, row: number, p: DBProduction) {
  const { sid, fromDb } = await resolveWriteCtx(email);
  await assertNoOverlapDirect(sid, p.시작일, p.종료일, row);
  const r = await updateProduction(sid, row, p);
  await syncDirectCount(sid, { row, 시작일: p.시작일, 종료일: p.종료일 }, fromDb);
  return r;
}
export async function removeProduction(email: string, row: number) {
  const sid = await resolveSheet(email);
  // 생산(E)은 유입(컨택)이 소유 — 레코드 삭제해도 E 불변. M 은 행과 함께 사라짐.
  return clearProduction(sid, row);
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
// (현수막 게시 = 생산 → 컨택 영업관리 E 소유. 게시로그 AF:AI 폐기, ADR-0025.)

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
