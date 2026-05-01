/**
 * Layer: repo — 03 DB관리 탭 I/O.
 * 4섹션(매입DB/직접생산/현수막/콜·지·기·소) raw log read/append/update/clear.
 *
 * SSOT: docs/domains/sheet-structure.md §5
 *
 * 가드레일:
 *   • 합계 행 보존: 첫 번째 컬럼이 "합계"인 행은 건너뜀 (data 식별 X, 쓰기 X)
 *   • 수식 컬럼 보호: 매입DB.주문금액(E), 직접생산.개당단가(N), 현수막.주문금액(U)는 쓰기 금지.
 *     append/update 시 그 셀 위치를 빈 문자열로 보내 시트 수식이 자동 계산되도록 함.
 *   • 행 단위 update/clear: row 번호로 식별 (값.append 안 씀)
 */
import { SHEET_RANGES } from "@/config";
import type {
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";
import { sheetsClient } from "./sheets-client";

const TAB = SHEET_RANGES.dbManagement.tab;
const MAX_ROW = SHEET_RANGES.dbManagement.maxRow;
const HEADER_ROW = SHEET_RANGES.dbManagement.headerRow;
const FIRST_DATA_ROW = HEADER_ROW + 1;

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

const T = tabRef(TAB);

// ── 시트 직렬값 → 표시용 변환 (날짜 등) ─────────────────────────
function serialToISODate(v: unknown): string {
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return toISO(d);
    return v;
  }
  if (typeof v === "number") {
    const ms = (v - 25569) * 86_400_000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return toISO(d);
  }
  return "";
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[₩,]/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

// 합계 행 식별: 첫 셀이 "합계"로 시작하면 합계
function isSumRow(firstCellVal: unknown): boolean {
  if (typeof firstCellVal !== "string") return false;
  return firstCellVal.trim().startsWith("합계");
}

// ── 4섹션 read ────────────────────────────────────────────────

interface RawSectionData<T> {
  rows: Array<T & { row: number }>;
}

async function readSection<T>(
  spreadsheetId: string,
  startCol: string,
  endCol: string,
  parser: (r: unknown[]) => T,
): Promise<RawSectionData<T>> {
  const range = `${T}!${startCol}${FIRST_DATA_ROW}:${endCol}${MAX_ROW}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = (res.data.values ?? []) as unknown[][];
  const rows: Array<T & { row: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    if (isSumRow(r[0])) continue; // 합계 행 skip
    // 모든 셀이 비어있으면 건너뜀 (truly empty)
    const hasContent = r.some(
      (c) => c !== undefined && c !== null && String(c).trim() !== "",
    );
    if (!hasContent) continue;
    const parsed = parser(r);
    rows.push({ ...parsed, row: FIRST_DATA_ROW + i });
  }
  return { rows };
}

// ── 매입DB (B:G) ──────────────────────────────────────────────
export async function readPurchases(spreadsheetId: string) {
  return readSection<DBPurchase>(
    spreadsheetId,
    "B",
    "G",
    (r) => ({
      구매일: serialToISODate(r[0]),
      업체명: toStr(r[1]),
      개당단가: toNum(r[2]),
      주문개수: toNum(r[3]),
      주문금액: toNum(r[4]),
      기타: toStr(r[5]),
    }),
  );
}

// ── 직접생산 (I:N) ────────────────────────────────────────────
export async function readProductions(spreadsheetId: string) {
  return readSection<DBProduction>(
    spreadsheetId,
    "I",
    "N",
    (r) => ({
      날짜: serialToISODate(r[0]),
      소재: toStr(r[1]),
      기간예산: toNum(r[2]),
      생산개수: toNum(r[3]),
      개당단가: toNum(r[4]),
      기타: toStr(r[5]),
    }),
  );
}

// ── 현수막 (P:V) ──────────────────────────────────────────────
export async function readBanners(spreadsheetId: string) {
  return readSection<DBBanner>(
    spreadsheetId,
    "P",
    "V",
    (r) => ({
      날짜: serialToISODate(r[0]),
      업체명: toStr(r[1]),
      도착일: serialToISODate(r[2]),
      개당단가: toNum(r[3]),
      주문개수: toNum(r[4]),
      주문금액: toNum(r[5]),
      기타: toStr(r[6]),
    }),
  );
}

// ── 콜·지·기·소 (X:AD) ─────────────────────────────────────────
export async function readLeads(spreadsheetId: string) {
  return readSection<DBLead>(
    spreadsheetId,
    "X",
    "AD",
    (r) => ({
      구분: toStr(r[0]),
      접수일: serialToISODate(r[1]),
      대표자명: toStr(r[2]),
      업체명: toStr(r[3]),
      소개처: toStr(r[4]),
      연락처: toStr(r[5]),
      조건: toStr(r[6]),
    }),
  );
}

// ── append / update / clear 헬퍼 ──────────────────────────────

/**
 * 섹션의 첫 번째 빈 데이터 행을 찾는다.
 * "합계" 행 위에서만 찾음 (합계 행 만나면 그 위 첫 빈 row 반환).
 * 빈 row 없으면 합계 row 자체를 반환 → 호출 측이 행 insert해야 함.
 */
async function findFirstEmptyRow(
  spreadsheetId: string,
  startCol: string,
  endCol: string,
): Promise<{ row: number; needInsert: boolean }> {
  const range = `${T}!${startCol}${FIRST_DATA_ROW}:${endCol}${MAX_ROW}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const values = (res.data.values ?? []) as unknown[][];
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    const first = r[0];
    if (isSumRow(first)) {
      // 합계 행 도달 — 그 자리에 insert해야 함 (현재는 row 자체 반환, 호출자가 처리)
      return { row: FIRST_DATA_ROW + i, needInsert: true };
    }
    const hasContent = r.some(
      (c) => c !== undefined && c !== null && String(c).trim() !== "",
    );
    if (!hasContent) return { row: FIRST_DATA_ROW + i, needInsert: false };
  }
  // 데이터 영역 끝까지 모두 차있으면 maxRow+1 (절대 도달 안 한다고 가정)
  return { row: MAX_ROW + 1, needInsert: false };
}

interface SectionWriteSpec {
  startCol: string;
  endCol: string;
  /** 시트 수식이 자동 계산하는 컬럼의 0-based 인덱스 (값 대신 빈 문자열 보냄). */
  formulaIndices: number[];
}

const SPEC = {
  매입DB: { startCol: "B", endCol: "G", formulaIndices: [4] }, // 주문금액 = idx 4 (E)
  직접생산: { startCol: "I", endCol: "N", formulaIndices: [4] }, // 개당단가 = idx 4 (M)
  현수막: { startCol: "P", endCol: "V", formulaIndices: [5] }, // 주문금액 = idx 5 (U)
  콜지기소: { startCol: "X", endCol: "AD", formulaIndices: [] },
} as const satisfies Record<string, SectionWriteSpec>;

async function writeRow(
  spreadsheetId: string,
  spec: SectionWriteSpec,
  row: number,
  values: (string | number)[],
): Promise<void> {
  // 수식 컬럼은 빈 문자열로 (시트 수식 보존)
  const out = values.map((v, i) =>
    spec.formulaIndices.includes(i) ? "" : v,
  );
  const range = `${T}!${spec.startCol}${row}:${spec.endCol}${row}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [out] },
  });
}

async function clearRowRange(
  spreadsheetId: string,
  spec: SectionWriteSpec,
  row: number,
): Promise<void> {
  const range = `${T}!${spec.startCol}${row}:${spec.endCol}${row}`;
  await sheetsClient().spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
}

// ── append (4섹션 각각) ───────────────────────────────────────

export async function appendPurchase(
  spreadsheetId: string,
  p: DBPurchase,
): Promise<{ row: number }> {
  const { row, needInsert } = await findFirstEmptyRow(
    spreadsheetId,
    SPEC.매입DB.startCol,
    SPEC.매입DB.endCol,
  );
  if (needInsert) {
    throw new Error(
      `[db.ts] 매입DB 데이터 영역(${FIRST_DATA_ROW}~${row - 1})이 가득 찼습니다. 시트의 합계 행을 ${MAX_ROW}행 이후로 옮겨주세요.`,
    );
  }
  await writeRow(spreadsheetId, SPEC.매입DB, row, [
    p.구매일,
    p.업체명,
    p.개당단가,
    p.주문개수,
    "", // 주문금액 = 시트 수식
    p.기타,
  ]);
  return { row };
}

export async function appendProduction(
  spreadsheetId: string,
  p: DBProduction,
): Promise<{ row: number }> {
  const { row, needInsert } = await findFirstEmptyRow(
    spreadsheetId,
    SPEC.직접생산.startCol,
    SPEC.직접생산.endCol,
  );
  if (needInsert)
    throw new Error(`[db.ts] 직접생산 영역 가득 — 합계 행을 옮겨주세요.`);
  await writeRow(spreadsheetId, SPEC.직접생산, row, [
    p.날짜,
    p.소재,
    p.기간예산,
    p.생산개수,
    "", // 개당단가 = 시트 수식
    p.기타,
  ]);
  return { row };
}

export async function appendBanner(
  spreadsheetId: string,
  b: DBBanner,
): Promise<{ row: number }> {
  const { row, needInsert } = await findFirstEmptyRow(
    spreadsheetId,
    SPEC.현수막.startCol,
    SPEC.현수막.endCol,
  );
  if (needInsert)
    throw new Error(`[db.ts] 현수막 영역 가득 — 합계 행을 옮겨주세요.`);
  await writeRow(spreadsheetId, SPEC.현수막, row, [
    b.날짜,
    b.업체명,
    b.도착일,
    b.개당단가,
    b.주문개수,
    "", // 주문금액 = 시트 수식
    b.기타,
  ]);
  return { row };
}

export async function appendLead(
  spreadsheetId: string,
  l: DBLead,
): Promise<{ row: number }> {
  const { row, needInsert } = await findFirstEmptyRow(
    spreadsheetId,
    SPEC.콜지기소.startCol,
    SPEC.콜지기소.endCol,
  );
  if (needInsert)
    throw new Error(`[db.ts] 콜·지·기·소 영역 가득 — 합계 행을 옮겨주세요.`);
  await writeRow(spreadsheetId, SPEC.콜지기소, row, [
    l.구분,
    l.접수일,
    l.대표자명,
    l.업체명,
    l.소개처,
    l.연락처,
    l.조건,
  ]);
  return { row };
}

// ── update (특정 row) ─────────────────────────────────────────

export async function updatePurchase(
  spreadsheetId: string,
  row: number,
  p: DBPurchase,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.매입DB, row, [
    p.구매일,
    p.업체명,
    p.개당단가,
    p.주문개수,
    "",
    p.기타,
  ]);
}

export async function updateProduction(
  spreadsheetId: string,
  row: number,
  p: DBProduction,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.직접생산, row, [
    p.날짜,
    p.소재,
    p.기간예산,
    p.생산개수,
    "",
    p.기타,
  ]);
}

export async function updateBanner(
  spreadsheetId: string,
  row: number,
  b: DBBanner,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.현수막, row, [
    b.날짜,
    b.업체명,
    b.도착일,
    b.개당단가,
    b.주문개수,
    "",
    b.기타,
  ]);
}

export async function updateLead(
  spreadsheetId: string,
  row: number,
  l: DBLead,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.콜지기소, row, [
    l.구분,
    l.접수일,
    l.대표자명,
    l.업체명,
    l.소개처,
    l.연락처,
    l.조건,
  ]);
}

// ── clear (특정 row) ──────────────────────────────────────────

export async function clearPurchase(spreadsheetId: string, row: number) {
  await clearRowRange(spreadsheetId, SPEC.매입DB, row);
}
export async function clearProduction(spreadsheetId: string, row: number) {
  await clearRowRange(spreadsheetId, SPEC.직접생산, row);
}
export async function clearBanner(spreadsheetId: string, row: number) {
  await clearRowRange(spreadsheetId, SPEC.현수막, row);
}
export async function clearLead(spreadsheetId: string, row: number) {
  await clearRowRange(spreadsheetId, SPEC.콜지기소, row);
}
