/**
 * Layer: service — DB관리 탭 유스케이스 (PR 09).
 *
 * 4채널 raw 입력 read/write. 합계·평균단가 계산은 시트 수식이 처리.
 */
import { randomUUID } from "node:crypto";
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
import { readMeetingsFromDb } from "@/repo/db/read-daily";
import { readAllMeetings } from "@/repo/meetings";
import { chooseDailySource, chooseWriteSource } from "./daily-source";
import { backfillMissingRows } from "./sheet-backfill";
import { sumChannelInflowOverPeriod } from "@/repo/sales";
import { persistProductionCell, type SalesCtx } from "./sales-write"; // R3⑤ 생산(E) DB 정본
import { selectLeadsForPicker, type LeadForPicker } from "./lead-list"; // 발굴 조회 PR-2
import { oldDateOf, oldLeadIdOf, readChannelRows } from "./db-old-values"; // BBE-246 — 500줄 캡 분리
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

/** sid + 쓰기 정본 여부. fromDb = 유입 합산 소스(R3-1, 읽기 게이트). syncDb = 03 편집 DB 동기 정본
 *  여부(R3-4, 쓰기 게이트). 현재 두 게이트 동일 판정이나 의미가 달라 각 함수로 산출(향후 분기 대비). */
async function resolveWriteCtx(
  email: string,
): Promise<{ sid: string; fromDb: boolean; syncDb: boolean; salesCtx: SalesCtx }> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[db] 등록되지 않은 사용자: ${email}`);
  const on = dbEnabled();
  return {
    sid: user.spreadsheetId,
    fromDb: chooseDailySource(user.cohort, on) === "db",
    syncDb: chooseWriteSource(user.cohort, on) === "db",
    salesCtx: { spreadsheetId: user.spreadsheetId, cohort: user.cohort, email },
  };
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

/** 4섹션 시트 read 묶음 — 절대 throw 안 함(내부 allSettled + 섹션별 rowsOrEmpty 강등).
 *  비파일럿 경로이자, 파일럿 union 의 시트 보충 소스로 재사용. */
async function readAllSheetSections(spreadsheetId: string): Promise<DBOverview> {
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

/**
 * 4섹션 한 번에 조회. allSettled — 한 섹션만 throw 해도 그 채널만 빈 목록, 나머지는 정상.
 * resolveSheet(사용자 없음)만 throw 유지.
 *
 * 파일럿: DB 단일 쿼리(정본) + 4섹션 시트 read 를 **병렬** 발사해, DB 에 없는(= append
 * 미러 실패로 누락된) 신규행만 섹션별 row 로 보충한다(union, R3 §7-3 L4). R2-5 의 "시트
 * 0회" 속도이득은 반납하나 지연은 max(DB,시트)=시트 수준. DB read 실패 시 이미 읽어둔
 * 시트 결과로 fallback(화면 에러 금지). 비파일럿 불변.
 */
export async function loadDBOverview(email: string): Promise<DBOverview> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[db] 등록되지 않은 사용자: ${email}`);
  const spreadsheetId = user.spreadsheetId;

  if (chooseDailySource(user.cohort, dbEnabled()) === "db") {
    const [dbSettled, sheet] = await Promise.all([
      readDbTabFromDb(spreadsheetId).then(
        (value) => ({ ok: true, value }) as const,
        (error) => ({ ok: false, error }) as const,
      ),
      readAllSheetSections(spreadsheetId),
    ]);
    if (dbSettled.ok) {
      const db = dbSettled.value;
      return {
        purchases: backfillMissingRows(db.purchases, sheet.purchases, (r) => r.row),
        productions: backfillMissingRows(db.productions, sheet.productions, (r) => r.row),
        banners: backfillMissingRows(db.banners, sheet.banners, (r) => r.row),
        leads: backfillMissingRows(db.leads, sheet.leads, (r) => r.row),
      };
    }
    Sentry.captureException(dbSettled.error, { tags: { where: "loadDBOverview-db-read" } });
    return sheet; // DB 실패 → 이미 읽어둔 시트 결과(추가 read 0)
  }

  return readAllSheetSections(spreadsheetId);
}

/**
 * 발굴(콜·지·기·소 영업기회) 목록 조회 — 컨택탭 발굴 피커(PR-3)용 (lead-chain PR-2).
 *
 * 접수일 내림차순 + 선택 검색. **시트 I/O 신규 0** — loadDBOverview 와 동일 게이트 재사용.
 *  · 파일럿(DB): readDbTabFromDb 의 leads(발굴id 포함) — 실패 시 시트 fallback + Sentry.
 *  · 비파일럿/DB실패: readLeads(시트 X:AD, 발굴id 미보유=legacy).
 * ⚠️ 발굴id 는 **DB payload 전용**(시트 컬럼 0)이라 파일럿만 실려 온다(§4-3).
 * `matched`(전환 여부) 파생은 **PR-6** 몫 — 여기선 순수 목록만(PR-3 는 PR-6 착지 후 !matched 필터).
 */
export async function loadLeadsForPicker(
  email: string,
  query = "",
): Promise<LeadForPicker[]> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[db] 등록되지 않은 사용자: ${email}`);
  const spreadsheetId = user.spreadsheetId;

  if (chooseDailySource(user.cohort, dbEnabled()) === "db") {
    const [dbSettled, sheetLeads] = await Promise.all([
      readDbTabFromDb(spreadsheetId).then(
        (value) => ({ ok: true, value }) as const,
        (error) => ({ ok: false, error }) as const,
      ),
      readLeads(spreadsheetId).then(
        (r) => r.rows,
        () => null, // 시트 실패 → 보충 없음(DB 정본만)
      ),
    ]);
    if (dbSettled.ok) {
      // DB 정본 + 시트 누락행(append 미러 실패) 보충. 보충 lead 는 발굴id 없음(시트 컬럼 0)
      // → isLeadMatched 가 업체명 폴백으로 흡수. row 조인(R3 §7-3 L4).
      const merged = sheetLeads
        ? backfillMissingRows(dbSettled.value.leads, sheetLeads, (l) => l.row)
        : dbSettled.value.leads;
      return selectLeadsForPicker(merged, query);
    }
    Sentry.captureException(dbSettled.error, { tags: { where: "loadLeadsForPicker-db-read" } });
    // ↓ DB 실패만 시트 경로로 silent fallback
  }
  try {
    const { rows } = await readLeads(spreadsheetId);
    return selectLeadsForPicker(rows, query);
  } catch (e) {
    Sentry.captureException(e, { tags: { where: "loadLeadsForPicker-sheet-read" } });
    return []; // 둘 다 실패 = 빈 목록(화면 에러 금지)
  }
}

/** 발굴 후보 = 발굴 목록 + `matched`(전환 여부) 파생 (lead-chain PR-6 · §7-1 계약). */
export interface LeadCandidate extends LeadForPicker {
  /** true = 이미 미팅으로 전환됨 → 피커는 `!matched` 만 노출. 저장 안 하고 파생(§4-1). */
  matched: boolean;
}

/** 콜·지·기·소 업체명 정규화 — 리스케줄 "(변경) " 접두·공백·대소문자 무시(업체명 폴백 매칭 키). */
function normVendor(name: string): string {
  return (name || "").replace(/^\(변경\)\s*/, "").trim().toLowerCase().replace(/\s+/g, "");
}

/** 미팅에서 뽑은 매칭 근거 — 발굴id(정확)·콜·지·기·소 업체명(폴백). */
interface MeetingLinkSets {
  ids: Set<string>;
  names: Set<string>;
}

/** lead 가 미팅으로 전환됐나 — 발굴id 있으면 링크 정확 매칭, 없으면 업체명 폴백(근사).
 * 발굴id·업체명 둘 다 없으면(대표자명만) 폴백 불가 → 영구 후보(false). lead-chain §4-1. */
function isLeadMatched(l: LeadForPicker, { ids, names }: MeetingLinkSets): boolean {
  if (l.발굴id) return ids.has(l.발굴id);
  const name = (l.업체명 || "").trim();
  if (!name) return false;
  return names.has(normVendor(name));
}

/** 미팅 집합 조회(게이트 재사용) — 파일럿=readMeetingsFromDb(발굴id 보유), 비파일럿=readAllMeetings(시트).
 * 업체명 폴백은 **콜·지·기·소 채널 미팅만** 집계(타 채널 동명 오탐 차단). read 실패 → 빈 집합
 * (안전 방향: 매칭 못 함 → 전 lead 후보로 남김, 목록은 정상 노출). */
async function readMeetingLinkSets(email: string): Promise<MeetingLinkSets> {
  const ids = new Set<string>();
  const names = new Set<string>();
  const user = await findUserByEmail(email);
  if (!user) return { ids, names };
  try {
    const meetings =
      chooseDailySource(user.cohort, dbEnabled()) === "db"
        ? await readMeetingsFromDb(user.spreadsheetId)
        : await readAllMeetings(user.spreadsheetId);
    for (const m of meetings) {
      if (m.발굴id) ids.add(m.발굴id);
      if (m.channel === "콜·지·기·소" && m.업체명) names.add(normVendor(m.업체명));
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { where: "listLeadCandidates-meetings-read" } });
  }
  return { ids, names };
}

/**
 * 발굴 후보 + `matched` 파생 — 컨택탭 발굴 피커(PR-3)가 소비할 §7-1 결선 계약 (lead-chain PR-6).
 *
 * **만료 없음**(belie 2026-07-15) — 미매칭이면 접수일이 지나도 계속 후보(이월). 피커가 `!matched` 필터.
 *  · matched = 발굴id 있으면 미팅 발굴id 집합 정확 매칭, 없으면 콜·지·기·소 미팅 업체명 폴백(근사).
 *  · 목록·게이트·검색은 loadLeadsForPicker 재사용, 미팅 집합은 readMeetingLinkSets(각자 시트폴백/빈집합).
 */
export async function listLeadCandidates(
  email: string,
  query = "",
): Promise<LeadCandidate[]> {
  const [leads, links] = await Promise.all([
    loadLeadsForPicker(email, query),
    readMeetingLinkSets(email),
  ]);
  return leads.map((l) => ({ ...l, matched: isLeadMatched(l, links) }));
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

/** DB 변경 후 그 (채널, 날짜) 생산(E) 재집계·기입. 실패해도 DB 저장은 성공(warn). */
async function syncProduction(ctx: SalesCtx, channel: Channel, date: string) {
  if (!date) return;
  try {
    const rows = await readChannelRows(ctx.spreadsheetId, channel);
    await persistProductionCell(ctx, date, channel, productionCountFor(channel, rows, date));
  } catch (e) {
    console.warn(`[db] 생산 집계 기입 실패 (${channel} ${date}):`, e instanceof Error ? e.message : e);
  }
}

// ── 매입DB ────────────────────────────────────────────────────
export async function addPurchase(email: string, p: DBPurchase) {
  const { sid, salesCtx } = await resolveWriteCtx(email);
  const r = await appendPurchase(sid, p);
  await syncProduction(salesCtx, "매입DB", p.구매일);
  return r;
}
export async function patchPurchase(email: string, row: number, p: DBPurchase) {
  const { sid, syncDb, salesCtx } = await resolveWriteCtx(email);
  const old = await oldDateOf(sid, "매입DB", row, syncDb);
  // finally: 시트 쓰기 후 DB dual-sync 가 throw 해도 생산(E) 재집계는 실행. E 는 시트 상태만
  // 의존하고 시트는 이미 확정(writeRow 완료) → skip 시 재시도가 옛 날짜를 잃어 E 영구 오집계(리뷰 CONFIRMED).
  try {
    return await updatePurchase(sid, row, p, { syncDb });
  } finally {
    await syncProduction(salesCtx, "매입DB", old);
    if (p.구매일 !== old) await syncProduction(salesCtx, "매입DB", p.구매일);
  }
}
export async function removePurchase(email: string, row: number) {
  const { sid, syncDb, salesCtx } = await resolveWriteCtx(email);
  const old = await oldDateOf(sid, "매입DB", row, syncDb);
  try {
    return await clearPurchase(sid, row, { syncDb });
  } finally {
    await syncProduction(salesCtx, "매입DB", old); // DB throw 여도 E 재집계(위 patchPurchase 주석)
  }
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
 *  fromDb(R3-1): 쓰기 정본이 DB 인 파일럿이면 유입 합산을 DB 에서(시트 미러 지연/실패 무관·정확).
 *  syncDb(BBE-61, R3-4b): 파일럿이면 M 의 DB 반영을 **기다린다**(non-throw — 컨택 저장 등 이미
 *  성공한 주 동작을 M 실패로 되돌리지 않음, db-production-cell.ts 참고). 비파일럿은 R2 미러 불변. */
async function syncDirectCount(
  sid: string,
  record: { row: number; 시작일: string; 종료일: string },
  fromDb: boolean,
  syncDb: boolean,
): Promise<number> {
  const count = await sumChannelInflowOverPeriod(sid, "직접생산", record.시작일, record.종료일, { fromDb });
  await writeProductionCountCell(sid, record.row, count, { syncDb });
  return count;
}

/** 컨택 유입 저장 후 그 날짜를 포함하는 활성 직접생산 레코드 M 동기화 (ADR-0024).
 *  활성 레코드 없으면 recordFound=false → 호출측(컨택)이 보류 모달.
 *  cohort: 쓰기 정본 판정용(파일럿+DB → 유입 합산 DB 정본, R3-1) — 읽기(fromDb)·쓰기(syncDb) 게이트가
 *  대칭이라 같은 cohort 판정을 두 번 씀(chooseDailySource·chooseWriteSource, daily-source.ts). */
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
  const on = dbEnabled();
  const count = await syncDirectCount(
    sid, active, chooseDailySource(cohort, on) === "db", chooseWriteSource(cohort, on) === "db",
  );
  return { recordFound: true, count };
}

export async function addProduction(email: string, p: DBProduction) {
  const { sid, fromDb, syncDb } = await resolveWriteCtx(email);
  await assertNoOverlapDirect(sid, p.시작일, p.종료일);
  const r = await appendProduction(sid, p);
  await syncDirectCount(sid, { row: r.row, 시작일: p.시작일, 종료일: p.종료일 }, fromDb, syncDb);
  return r;
}
export async function patchProduction(email: string, row: number, p: DBProduction) {
  const { sid, fromDb, syncDb } = await resolveWriteCtx(email);
  await assertNoOverlapDirect(sid, p.시작일, p.종료일, row);
  const r = await updateProduction(sid, row, p, { syncDb });
  // syncDirectCount → writeProductionCountCell(M) 은 파일럿이면 DB 반영을 기다리되 non-throw(BBE-61).
  await syncDirectCount(sid, { row, 시작일: p.시작일, 종료일: p.종료일 }, fromDb, syncDb);
  return r;
}
export async function removeProduction(email: string, row: number) {
  const { sid, syncDb } = await resolveWriteCtx(email);
  // 생산(E)은 유입(컨택)이 소유 — 레코드 삭제해도 E 불변. M 은 행과 함께 사라짐.
  return clearProduction(sid, row, { syncDb });
}

// ── 현수막 주문 (P:V) ─────────────────────────────────────────
// 주문은 생산 E 를 만들지 않는다(생산=게시 로그). 비용(주문금액)만 대시보드에 반영.
export async function addBanner(email: string, b: DBBanner) {
  const sid = await resolveSheet(email);
  return appendBanner(sid, b);
}
export async function patchBanner(email: string, row: number, b: DBBanner) {
  const { sid, syncDb } = await resolveWriteCtx(email);
  return updateBanner(sid, row, b, { syncDb });
}
export async function removeBanner(email: string, row: number) {
  const { sid, syncDb } = await resolveWriteCtx(email);
  return clearBanner(sid, row, { syncDb });
}
// (현수막 게시 = 생산 → 컨택 영업관리 E 소유. 게시로그 AF:AI 폐기, ADR-0025.)

// ── 콜·지·기·소 ────────────────────────────────────────────────
export async function addLead(email: string, l: DBLead) {
  const { sid, salesCtx } = await resolveWriteCtx(email);
  // 발굴 안정 id 부여(lead-chain §4-3) — appendLead 가 payload 에 항상 명시(R10: 재사용 행의 옛 id 를 덮음).
  // 클라이언트발 발굴id 는 라우트에서 strip 되므로 항상 새로 생성한다.
  const r = await appendLead(sid, { ...l, 발굴id: randomUUID() });
  await syncProduction(salesCtx, "콜·지·기·소", l.접수일);
  return r;
}
export async function patchLead(email: string, row: number, l: DBLead) {
  const { sid, syncDb, salesCtx } = await resolveWriteCtx(email);
  // R13: 클라이언트 바디 l 은 발굴id 를 모른다. 서버가 기존 id 를 읽어 명시 전달(없으면 지연 부여).
  //  · 옛 접수일(E 재집계용) = oldDateOf(BBE-246: 파일럿은 DB 우선, 실패 시 시트 폴백).
  //  · 기존 발굴id = oldLeadIdOf(파일럿만 DB payload read — 발굴id 는 시트 컬럼 0이라 시트로는 못 읽는다).
  const old = await oldDateOf(sid, "콜·지·기·소", row, syncDb);
  const prevId = await oldLeadIdOf(sid, row, syncDb);
  // "keep"(DB read 실패) = 알 수 없음 → 발굴id 를 payload 에서 omit → jsonb 얕은 병합이 기존 값 보존.
  //   (덮으면 순단 시 remint 로 안정 id 파괴 — read 무재시도·write 재시도 비대칭이라 실제로 발생.)
  // "mint"(확실히 없음) → 새 uuid. string → 그 값 보존.
  const payload: DBLead = prevId === "keep" ? l : { ...l, 발굴id: prevId === "mint" ? randomUUID() : prevId };
  try {
    return await updateLead(sid, row, payload, { syncDb });
  } finally {
    await syncProduction(salesCtx, "콜·지·기·소", old); // DB throw 여도 E 재집계(patchPurchase 주석)
    if (l.접수일 !== old) await syncProduction(salesCtx, "콜·지·기·소", l.접수일);
  }
}
export async function removeLead(email: string, row: number) {
  const { sid, syncDb, salesCtx } = await resolveWriteCtx(email);
  const old = await oldDateOf(sid, "콜·지·기·소", row, syncDb);
  try {
    return await clearLead(sid, row, { syncDb });
  } finally {
    await syncProduction(salesCtx, "콜·지·기·소", old); // DB throw 여도 E 재집계(patchPurchase 주석)
  }
}
