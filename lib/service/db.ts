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
import { sumChannelInflowOverPeriod } from "@/repo/sales";
import { persistProductionCell, type SalesCtx } from "./sales-write"; // R3⑤ 생산(E) DB 정본
import { selectLeadsForPicker, type LeadForPicker } from "./lead-list"; // 발굴 조회 PR-2
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
    try {
      const { leads } = await readDbTabFromDb(spreadsheetId);
      return selectLeadsForPicker(leads, query); // DB 정본 — 빈 목록도 정답(시트 fallback 안 함)
    } catch (e) {
      Sentry.captureException(e, { tags: { where: "loadLeadsForPicker-db-read" } });
      // ↓ DB 실패만 시트 경로로 silent fallback
    }
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
async function syncProduction(ctx: SalesCtx, channel: Channel, date: string) {
  if (!date) return;
  try {
    const rows = await readChannelRows(ctx.spreadsheetId, channel);
    await persistProductionCell(ctx, date, channel, productionCountFor(channel, rows, date));
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

/** oldLeadId 3-state — "없음(mint)" 과 "읽기 실패(보존)" 을 구분한다(핵심).
 *  · string  = 기존 발굴id (보존)
 *  · "mint"  = 기존 id 확실히 없음(백필/legacy/비파일럿) → 새로 부여
 *  · "keep"  = DB read 실패로 알 수 없음 → **발굴id 를 payload 에서 omit**(jsonb 병합이 기존 값 보존) */
type OldLeadId = string | "mint" | "keep";

/** 콜·지·기·소 특정 row 의 기존 발굴id. ⚠️ 시트 리더(readLeads=X:AD 파서 7필드)는 **발굴id 를 못 만든다**
 * (발굴id=DB payload 전용·시트 컬럼 0). 발굴id 를 실어오는 read 는 **readDbTabFromDb**(DB overlay)뿐 —
 * read-db-tab.ts 헤더가 경고한 "시트 db.ts vs Postgres db/" 혼동에 빠지지 말 것.
 * read 실패를 "없음"과 혼동하면 순단 시 remint 로 안정 id 를 파괴하므로, 실패는 "keep"(보존)으로 분리한다. */
async function oldLeadIdOf(spreadsheetId: string, row: number, syncDb: boolean): Promise<OldLeadId> {
  if (!syncDb) return "mint"; // 비파일럿=시트 read라 발굴id 부재 → 새로 부여
  try {
    const { leads } = await readDbTabFromDb(spreadsheetId);
    return leads.find((l) => l.row === row)?.발굴id || "mint";
  } catch {
    return "keep"; // DB 순단 등 — 알 수 없음 → 덮지 말고 기존 값 보존(omit)
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
  const old = await oldDateOf(sid, "매입DB", row);
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
  const old = await oldDateOf(sid, "매입DB", row);
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
  const { sid, fromDb, syncDb } = await resolveWriteCtx(email);
  await assertNoOverlapDirect(sid, p.시작일, p.종료일, row);
  const r = await updateProduction(sid, row, p, { syncDb });
  // syncDirectCount → writeProductionCountCell(M) 은 R2 async 유지(컨택 저장 경유 호출 회귀 회피, R3-4b).
  await syncDirectCount(sid, { row, 시작일: p.시작일, 종료일: p.종료일 }, fromDb);
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
  //  · 옛 접수일(E 재집계용) = oldDateOf(시트 readLeads — 시트에 있는 값).
  //  · 기존 발굴id = oldLeadIdOf(파일럿만 DB payload read — 발굴id 는 시트 컬럼 0이라 시트로는 못 읽는다).
  const old = await oldDateOf(sid, "콜·지·기·소", row);
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
  const old = await oldDateOf(sid, "콜·지·기·소", row);
  try {
    return await clearLead(sid, row, { syncDb });
  } finally {
    await syncProduction(salesCtx, "콜·지·기·소", old); // DB throw 여도 E 재집계(patchPurchase 주석)
  }
}
