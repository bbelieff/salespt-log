/**
 * Layer: repo — R2-5 DB생산 탭(03 DB관리) 4섹션 DB read (db-read-production).
 *
 * ⚠️ 이름 혼동 주의: lib/repo/db.ts = **시트 03 DB관리 탭** I/O, lib/repo/db/ = **Postgres**.
 * 이 파일은 후자에서 전자의 4섹션(매입DB·직접생산·현수막·콜지기소)을 재현한다.
 *
 * sheet_rows(tab='db') payload 2형태:
 *   • dual-write(db.ts append/update) = **이미 파싱된 타입 객체**(DBPurchase 등 필드명).
 *   • backfill = **절대 열문자**(섹션별 시작 열 다름 — DB_SECTIONS.absStart) + `_backfill:true`.
 * 형태별 분기(중요): 필드명은 **Zod parse**(파서 재실행 금지 — 직접생산 neo 레이아웃 감지가
 * 배열 위치 의존이라, 종료일 빈 "생산중" 행을 배열로 되돌리면 필드가 밀림). 열문자는 절대→상대
 * 배열 복원 후 **시트 파서(parseXRow) 재사용**. 파생값(주문금액·개당단가)은 양 경로 모두
 * 시트 파서와 같은 식으로 재계산해 정합 고정(tests/service/db-read-production.test.ts).
 */
import { DBBanner, DBLead, DBProduction, DBPurchase } from "@/types";
import {
  DB_SECTIONS,
  isBannerMeaningful,
  isLeadMeaningful,
  isProductionMeaningful,
  isPurchaseMeaningful,
  isSumRow,
  parseBannerRow,
  parseLeadRow,
  parseProductionRow,
  parsePurchaseRow,
} from "../db";
import { dbEnabled, ensureSchema, getDbPool } from "./client";

function colName(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
}
function coerce(v: unknown): unknown {
  if (typeof v !== "string") return v;
  if (v === "true" || v === "TRUE") return true;
  if (v === "false" || v === "FALSE") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

/** backfill 열문자 payload → 섹션 상대 배열(절대열 − 섹션 시작). 필드명이면 null. */
function relRowIfColumnForm(
  payload: Record<string, unknown>,
  section: keyof typeof DB_SECTIONS,
): unknown[] | null {
  const abs = DB_SECTIONS[section].absStart;
  // 열문자 형태 판정: 섹션 첫 열(절대) 키가 있으면 backfill.
  if (payload[colName(abs)] === undefined) return null;
  const r: unknown[] = [];
  for (let i = 0; i < 8; i++) r.push(coerce(payload[colName(abs + i)]));
  return r;
}

// 파생 재계산 — 시트 파서와 동일 식(dual-write payload 가 파생을 안 담았어도 맞춤).
function withPurchaseDerived(p: DBPurchase): DBPurchase {
  return { ...p, 주문금액: p.개당단가 * p.주문개수 };
}
function withBannerDerived(b: DBBanner): DBBanner {
  return { ...b, 주문금액: b.개당단가 * b.주문개수 };
}
function withProductionDerived(p: DBProduction): DBProduction {
  return { ...p, 개당단가: p.생산개수 > 0 ? Math.round(p.기간예산 / p.생산개수) : 0 };
}

interface DbRow { row_key: string; payload: Record<string, unknown> }

/** 4섹션 raw(각 row 포함) — service DBOverview 와 동일 형태(레이어상 repo 로컬 타입). */
export interface DbTabSections {
  purchases: Array<DBPurchase & { row: number }>;
  productions: Array<DBProduction & { row: number }>;
  banners: Array<DBBanner & { row: number }>;
  leads: Array<DBLead & { row: number }>;
}

/** 03 DB관리 4섹션 전체 (loadDBOverview 동치). _cleared·합계행·phantom 제외. */
export async function readDbTabFromDb(spreadsheetId: string): Promise<DbTabSections> {
  if (!dbEnabled()) throw new Error("[db] DATABASE_URL 미설정 — 호출부 게이트 오류");
  await ensureSchema();
  const res = await getDbPool().query(
    `select row_key, payload from sheet_rows
     where spreadsheet_id = $1 and tab = 'db'
       and coalesce((payload->>'_cleared')::boolean, false) = false`,
    [spreadsheetId],
  );

  const purchases: DbTabSections["purchases"] = [];
  const productions: DbTabSections["productions"] = [];
  const banners: DbTabSections["banners"] = [];
  const leads: DbTabSections["leads"] = [];

  for (const { row_key, payload } of res.rows as DbRow[]) {
    const rowNum = Number(row_key.replace(/^.*:r/, ""));

    if (row_key.startsWith(DB_SECTIONS.매입DB.keyPrefix + ":")) {
      const rel = relRowIfColumnForm(payload, "매입DB");
      if (rel && isSumRow(rel[0])) continue;
      const p = rel ? parsePurchaseRow(rel) : safe(DBPurchase, payload, withPurchaseDerived);
      if (p && isPurchaseMeaningful(p)) purchases.push({ ...withPurchaseDerived(p), row: rowNum });
    } else if (row_key.startsWith(DB_SECTIONS.직접생산.keyPrefix + ":")) {
      const rel = relRowIfColumnForm(payload, "직접생산");
      if (rel && isSumRow(rel[0])) continue;
      const p = rel ? parseProductionRow(rel) : safe(DBProduction, payload, withProductionDerived);
      if (p && isProductionMeaningful(p)) productions.push({ ...withProductionDerived(p), row: rowNum });
    } else if (row_key.startsWith(DB_SECTIONS.현수막.keyPrefix + ":")) {
      const rel = relRowIfColumnForm(payload, "현수막");
      if (rel && isSumRow(rel[0])) continue;
      const b = rel ? parseBannerRow(rel) : safe(DBBanner, payload, withBannerDerived);
      if (b && isBannerMeaningful(b)) banners.push({ ...withBannerDerived(b), row: rowNum });
    } else if (row_key.startsWith(DB_SECTIONS.콜지기소.keyPrefix + ":")) {
      const rel = relRowIfColumnForm(payload, "콜지기소");
      if (rel && isSumRow(rel[0])) continue;
      const l = rel ? parseLeadRow(rel) : safe(DBLead, payload, (x) => x);
      if (l && isLeadMeaningful(l)) leads.push({ ...l, row: rowNum });
    }
  }
  const byRow = (a: { row?: number }, b: { row?: number }) => (a.row ?? 0) - (b.row ?? 0);
  purchases.sort(byRow); productions.sort(byRow); banners.sort(byRow); leads.sort(byRow);
  return { purchases, productions, banners, leads };
}

/** dual-write 필드명 payload → 타입(Zod). 파생 보강. 실패 null. (파서 재실행 안 함 — neo 안전) */
function safe<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
  payload: Record<string, unknown>,
  derive: (v: T) => T,
): T | null {
  const r = schema.safeParse(payload);
  return r.success ? derive(r.data) : null;
}
