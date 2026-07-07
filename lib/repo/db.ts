/**
 * Layer: repo — 03 DB관리 탭 I/O. 4섹션 raw log read/append/update/clear. SSOT: sheet-structure.md §5
 * 가드: "합계" 시작 행 보존(쓰기 X) · 계산 컬럼은 빈문자열로 보내 시트 수식 자동 · 행 식별은 row 번호.
 */
import { SHEET_RANGES } from "@/config";
import type {
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";
import { sheetsClient } from "./sheets-client";
import { mirrorSheetRow, mirrorClearRow } from "./db/mirror";

const TAB = SHEET_RANGES.dbManagement.tab;
const MAX_ROW = SHEET_RANGES.dbManagement.maxRow;
const HEADER_ROW = SHEET_RANGES.dbManagement.headerRow;
// 실제 시트 검증(★★★세일즈PT 양식, 2026-05-06): 4채널 모두 1~3행 헤더, 4행~ 데이터.
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

// 시트 boolean 셀(UNFORMATTED → boolean) 또는 "TRUE" 문자열 → boolean. 빈 셀 = false.
function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().toUpperCase() === "TRUE";
  return Boolean(v);
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
  // 사용자 입력 기준 의미있는 row 판정(수식·기본값만 찬 phantom 제외 — 명시 추가분만 표시).
  isMeaningful: (parsed: T) => boolean,
  firstDataRow: number = FIRST_DATA_ROW,
): Promise<RawSectionData<T>> {
  const range = `${T}!${startCol}${firstDataRow}:${endCol}${MAX_ROW}`;
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
    const parsed = parser(r);
    // 사용자가 입력한 필드 기준 필터 — 수식 셀(예: 주문금액)만 채워진
    // phantom row는 "추가 버튼으로 명시 추가한 row만 표시" 원칙에 따라 숨김.
    if (!isMeaningful(parsed)) continue;
    rows.push({ ...parsed, row: firstDataRow + i });
  }
  return { rows };
}

/** 유효한 YYYY-MM-DD 형식인지 — 헤더 row의 "구매일"·"날짜" 같은
 *  텍스트와 실제 사용자 입력 날짜를 구분하는 핵심 검사. */
function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// 매입DB (B:H) — 구매일/업체명/개당단가/주문개수/부가세여부(F)/기타. F=boolean 신규, number=구 H fallback.
export async function readPurchases(spreadsheetId: string) {
  return readSection<DBPurchase>(
    spreadsheetId,
    "B",
    "H",
    (r) => {
      const 개당단가 = toNum(r[2]);
      const 주문개수 = toNum(r[3]);
      return {
        구매일: serialToISODate(r[0]),
        업체명: toStr(r[1]),
        개당단가,
        주문개수,
        주문금액: 개당단가 * 주문개수, // 계산값(미저장)
        기타: toStr(r[5]),
        부가세여부: typeof r[4] === "boolean" ? r[4] : toBool(r[6]), // 신규 F or 구 H
      };
    },
    (p) => isISODate(p.구매일),
  );
}

// 직접생산 (I:O) — 시작/종료/소재/예산/생산개수(M=유입 동기화,ADR-0024)/부가세여부(N)/기타. J=날짜면 신규.
export async function readProductions(spreadsheetId: string) {
  return readSection<DBProduction>(
    spreadsheetId,
    "I",
    "O",
    (r) => {
      const 시작일 = serialToISODate(r[0]);
      const neo = isISODate(serialToISODate(r[1])); // J=날짜 → 신규 레이아웃
      const 기간예산 = toNum(r[neo ? 3 : 2]);
      const 생산개수 = toNum(r[neo ? 4 : 3]);
      return {
        시작일,
        종료일: neo ? serialToISODate(r[1]) : 시작일,
        소재: toStr(r[neo ? 2 : 1]),
        기간예산,
        생산개수,
        부가세여부: neo ? toBool(r[5]) : false,
        기타: toStr(r[neo ? 6 : 5]),
        개당단가: 생산개수 > 0 ? Math.round(기간예산 / 생산개수) : 0,
      };
    },
    (p) => isISODate(p.시작일),
  );
}

// 현수막 (P:W) — 날짜/업체명/도착일/개당단가/주문개수/부가세여부(U)/기타. U=boolean 신규, number=구 W fallback.
export async function readBanners(spreadsheetId: string) {
  return readSection<DBBanner>(
    spreadsheetId,
    "P",
    "W",
    (r) => {
      const 개당단가 = toNum(r[3]);
      const 주문개수 = toNum(r[4]);
      return {
        날짜: serialToISODate(r[0]),
        업체명: toStr(r[1]),
        도착일: serialToISODate(r[2]),
        개당단가,
        주문개수,
        주문금액: 개당단가 * 주문개수, // 계산값(미저장)
        기타: toStr(r[6]),
        부가세여부: typeof r[5] === "boolean" ? r[5] : toBool(r[7]), // 신규 U or 구 W
      };
    },
    (p) => isISODate(p.날짜),
  );
}

// 콜·지·기·소 (X:AD) — 전부 사용자 입력(수식 없음). "구분"은 dropdown 기본값이라 인정 기준 제외.
// 필터: 대표자명 OR 업체명 OR 연락처 하나는 입력해야 인정.
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
    (p) =>
      Boolean(p.대표자명) || Boolean(p.업체명) || Boolean(p.연락처),
  );
}

// ── append / update / clear 헬퍼 ──────────────────────────────

/** 첫 빈 데이터 행 찾기("합계" 위, 없으면 합계 row→insert). isPhantom 은 read isMeaningful 과 동일 기준. */
async function findFirstEmptyRow(
  spreadsheetId: string,
  startCol: string,
  endCol: string,
  isPhantom: (r: unknown[]) => boolean,
  firstDataRow: number = FIRST_DATA_ROW,
): Promise<{ row: number; needInsert: boolean }> {
  const range = `${T}!${startCol}${firstDataRow}:${endCol}${MAX_ROW}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const values = (res.data.values ?? []) as unknown[][];
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    const first = r[0];
    if (isSumRow(first)) {
      return { row: firstDataRow + i, needInsert: true };
    }
    if (isPhantom(r)) return { row: firstDataRow + i, needInsert: false };
  }
  return { row: MAX_ROW + 1, needInsert: false };
}

// ── isPhantom: 사용자 입력 기준 빈 row 판정 (read isMeaningful의 negation) ──
const isISODateStr = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const phantomPurchase = (r: unknown[]) => !isISODateStr(serialToISODate(r[0]));
const phantomProduction = (r: unknown[]) => !isISODateStr(serialToISODate(r[0]));
const phantomBanner = (r: unknown[]) => !isISODateStr(serialToISODate(r[0]));
const phantomLead = (r: unknown[]) =>
  !toStr(r[2]) && !toStr(r[3]) && !toStr(r[5]); // 대표자명·업체명·연락처 모두 빈값

interface SectionWriteSpec {
  startCol: string;
  endCol: string;
  /** idx → (row) → "=D4*E4" 수식 문자열. web이 직접 박아넣어 시트 템플릿 의존 제거. */
  formulas: Record<number, (row: number) => string>;
}

// §3-A: 부가세여부=매입DB F·현수막 U·직접생산 N. 주문금액·개당단가 미저장(계산값). 직접생산 I:O 재배치.
const SPEC = {
  매입DB: { startCol: "B", endCol: "H", formulas: {} },
  직접생산: { startCol: "I", endCol: "O", formulas: {} },
  현수막: { startCol: "P", endCol: "W", formulas: {} },
  콜지기소: { startCol: "X", endCol: "AD", formulas: {} },
} as const satisfies Record<string, SectionWriteSpec>;

async function writeRow(
  spreadsheetId: string,
  spec: SectionWriteSpec,
  row: number,
  values: (string | number | boolean)[],
): Promise<void> {
  // 수식 컬럼은 spec.formulas에 정의된 수식 문자열로 치환 (시트 템플릿 누락 방지).
  const out = values.map((v, i) => {
    const formulaFor = spec.formulas[i];
    return formulaFor ? formulaFor(row) : v;
  });
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
    phantomPurchase,
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
    p.부가세여부, // F (구 주문금액 자리)
    p.기타, // G
    "", // H 정리(구 #425 부가세여부 자리)
  ]);
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `매입DB:r${row}`, payload: { ...p } }); // P1
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
    phantomProduction,
  );
  if (needInsert)
    throw new Error(`[db.ts] 직접생산 영역 가득 — 합계 행을 옮겨주세요.`);
  await writeRow(spreadsheetId, SPEC.직접생산, row, [
    p.시작일, // I
    p.종료일, // J
    p.소재, // K
    p.기간예산, // L (부가세 제외)
    p.생산개수, // M (빈/0=생산중)
    p.부가세여부, // N
    p.기타, // O (구 스페이서 자리)
  ]);
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `직접생산:r${row}`, payload: { ...p } }); // P1
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
    phantomBanner,
  );
  if (needInsert)
    throw new Error(`[db.ts] 현수막 영역 가득 — 합계 행을 옮겨주세요.`);
  await writeRow(spreadsheetId, SPEC.현수막, row, [
    b.날짜,
    b.업체명,
    b.도착일,
    b.개당단가,
    b.주문개수,
    b.부가세여부, // U (구 주문금액 자리)
    b.기타, // V
    "", // W 정리(구 #425 부가세여부 자리)
  ]);
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `현수막:r${row}`, payload: { ...b } }); // P1
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
    phantomLead,
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
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `콜지기소:r${row}`, payload: { ...l } }); // P1
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
    p.부가세여부, // F
    p.기타, // G
    "", // H 정리
  ]);
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `매입DB:r${row}`, payload: { ...p } }); // P1
}

export async function updateProduction(
  spreadsheetId: string,
  row: number,
  p: DBProduction,
): Promise<void> {
  await writeRow(spreadsheetId, SPEC.직접생산, row, [
    p.시작일, // I
    p.종료일, // J
    p.소재, // K
    p.기간예산, // L
    p.생산개수, // M
    p.부가세여부, // N
    p.기타, // O
  ]);
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `직접생산:r${row}`, payload: { ...p } }); // P1
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
    b.부가세여부, // U
    b.기타, // V
    "", // W 정리
  ]);
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `현수막:r${row}`, payload: { ...b } }); // P1
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
  mirrorSheetRow({ spreadsheetId, tab: "db", rowKey: `콜지기소:r${row}`, payload: { ...l } }); // P1
}

// ── clear (특정 row) ──────────────────────────────────────────

export async function clearPurchase(spreadsheetId: string, row: number) {
  await clearRowRange(spreadsheetId, SPEC.매입DB, row);
  mirrorClearRow({ spreadsheetId, tab: "db", rowKey: `매입DB:r${row}` }); // P1
}
export async function clearProduction(spreadsheetId: string, row: number) {
  await clearRowRange(spreadsheetId, SPEC.직접생산, row);
  mirrorClearRow({ spreadsheetId, tab: "db", rowKey: `직접생산:r${row}` }); // P1
}
export async function clearBanner(spreadsheetId: string, row: number) {
  await clearRowRange(spreadsheetId, SPEC.현수막, row);
  mirrorClearRow({ spreadsheetId, tab: "db", rowKey: `현수막:r${row}` }); // P1
}
export async function clearLead(spreadsheetId: string, row: number) {
  await clearRowRange(spreadsheetId, SPEC.콜지기소, row);
  mirrorClearRow({ spreadsheetId, tab: "db", rowKey: `콜지기소:r${row}` }); // P1
}

export { writeProductionCountCell } from "./db-production-cell";
