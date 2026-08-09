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

/** 행번호 결정 — BBE-59(R7-#10 Phase 1) 이후 신규 append 는 UUID 키(`{섹션}:{uuid}`)라 row_key
 * 파싱이 안 통한다. payload._row(신규 append 가 명시 기록)를 우선 신뢰하고, 없으면(레거시
 * `{섹션}:r{row}` 행) 기존 방식대로 row_key 말미를 파싱한다. */
function rowNumOf(row_key: string, payload: Record<string, unknown>): number {
  const explicit = Number(payload._row);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Number(row_key.replace(/^.*:r/, ""));
}

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
    const rowNum = rowNumOf(row_key, payload);

    if (row_key.startsWith(DB_SECTIONS.매입DB.keyPrefix + ":")) {
      const rel = relRowIfColumnForm(payload, "매입DB");
      if (rel && isSumRow(rel[0])) continue;
      const p = merged(DBPurchase, rel && parsePurchaseRow(rel), payload, withPurchaseDerived, row_key);
      if (p && isPurchaseMeaningful(p)) purchases.push({ ...withPurchaseDerived(p), row: rowNum });
    } else if (row_key.startsWith(DB_SECTIONS.직접생산.keyPrefix + ":")) {
      const rel = relRowIfColumnForm(payload, "직접생산");
      if (rel && isSumRow(rel[0])) continue;
      const p = merged(DBProduction, rel && parseProductionRow(rel), payload, withProductionDerived, row_key);
      if (p && isProductionMeaningful(p)) productions.push({ ...withProductionDerived(p), row: rowNum });
    } else if (row_key.startsWith(DB_SECTIONS.현수막.keyPrefix + ":")) {
      const rel = relRowIfColumnForm(payload, "현수막");
      if (rel && isSumRow(rel[0])) continue;
      const b = merged(DBBanner, rel && parseBannerRow(rel), payload, withBannerDerived, row_key);
      if (b && isBannerMeaningful(b)) banners.push({ ...withBannerDerived(b), row: rowNum });
    } else if (row_key.startsWith(DB_SECTIONS.콜지기소.keyPrefix + ":")) {
      const rel = relRowIfColumnForm(payload, "콜지기소");
      if (rel && isSumRow(rel[0])) continue;
      const l = merged(DBLead, rel && parseLeadRow(rel), payload, (x) => x, row_key);
      if (l && isLeadMeaningful(l)) leads.push({ ...l, row: rowNum });
    }
  }
  const byRow = (a: { row?: number }, b: { row?: number }) => (a.row ?? 0) - (b.row ?? 0);
  purchases.sort(byRow); productions.sort(byRow); banners.sort(byRow); leads.sort(byRow);
  return { purchases, productions, banners, leads };
}

/** payload 에서 **앱이 쓴 필드명 키**만 추출 — 백필 열문자(A~AZ)·내부키(_cleared 등) 제외. */
function fieldNameKeys(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (/^[A-Z]{1,2}$/.test(k)) continue; // 백필 열문자 폼
    if (k.startsWith("_")) continue; // _cleared·_backfill 등 내부 마킹
    out[k] = v;
  }
  return out;
}

/**
 * 열문자 base + **필드명 overlay** → 타입(Zod). 파생 보강. 실패 null.
 *
 * 왜 overlay 인가: DB upsert 는 **jsonb 얕은 병합**이라 백필된 행(열문자 키)을 앱이 수정해도
 * 옛 `X..AD` 가 그대로 남는다. 예전 구현은 열문자 폼을 **무조건 우선**했으므로 **앱이 쓴 필드명 값이
 * 영영 안 보였다** — 파일럿에서 03 을 고쳐도 화면은 옛 값을 표시(라이브 stale 버그).
 * 이제 열문자를 base 로 깔고 **필드명이 항상 이긴다**(= `contractFromDbPayload` 와 같은 규칙).
 *
 * 배열 파서(`parseXRow`)는 **열문자에만** 재실행한다 — 필드명 payload 에 배열 파서를 다시 돌리면
 * 직접생산 neo 레이아웃에서 열이 밀린다(기존 규칙 유지).
 */
function merged<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
  base: object | null,
  payload: Record<string, unknown>,
  derive: (v: T) => T,
  rowKey: string,
): T | null {
  const overlay = fieldNameKeys(payload);
  const candidate = { ...(base ?? {}), ...overlay };
  const r = schema.safeParse(candidate);
  if (r.success) return derive(r.data);
  // ⚠️ **렌더 보증 보존** — 열문자 base 는 예전에 Zod 를 거치지 않고 그대로 렌더됐다
  // (`rel ? parseXRow(rel) : safe(...)`). 백필 raw 값은 Zod refinement 를 자주 깬다:
  // 기간예산은 부가세 제외(=금액/1.1)라 거의 모든 금액이 소수(2999999.9999999995)이고,
  // 종료일이 빈 "생산중" 행은 legacy 분기가 생산개수←기간예산으로 매핑해 int 위반 → safeParse 실패.
  // 여기서 null 을 돌려주면 그 행이 03 화면·대시보드 집계에서 **조용히 사라진다**(시트 모드에선 보임 = 분기).
  // → Zod 는 **overlay 검증용**으로만 쓰고, 실패해도 base+overlay 를 그대로 렌더한다(예전과 동일 보증).
  if (!base) return null; // 순수 필드명 폼: 예전 safe() 도 null 이었다(동일)
  console.warn(`[read-db-tab] zod 실패 — 백필 base 로 렌더 유지: ${rowKey}`);
  return derive(candidate as T);
}
