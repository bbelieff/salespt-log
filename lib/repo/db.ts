/**
 * Layer: repo — 03 DB관리 탭 I/O. 4섹션 raw log read/append/update/clear. SSOT: sheet-structure.md §5
 * 가드: "합계" 시작 행 보존(쓰기 X) · 계산 컬럼은 빈문자열로 보내 시트 수식 자동 · 행 식별은 row 번호.
 *
 * row_key (BBE-59, R7-#10 Phase 1): append 는 `mintRowKey`(UUID, 행번호 무관)로 새 키를 발급하고
 * payload 에 `_row` 를 명시 저장한다(과거 `{섹션}:r{row}` 는 행번호=시트 findFirstEmptyRow 할당이라
 * 재시도 시 중복행이 생기고, clear 후 재사용 시 옛 필드가 jsonb 병합으로 잔존했다 — db/row-key.ts
 * 헤더 참고). update/clear 는 `resolveWriteKey` 로 그 물리 행에 **현재 매핑된** 키(레거시 또는
 * 신규)를 조회해서 쓴다 — 마이그레이션(Phase 2, 미실행) 전까지 두 형식이 공존한다.
 */
import { SHEET_RANGES } from "@/config";
import type {
  DBBanner,
  DBLead,
  DBProduction,
  DBPurchase,
} from "@/types";
import { sheetsClient } from "./sheets-client";
import { mirrorDbTabRowDurable } from "./db-tab-append-mirror";
import { mintRowKey } from "./db/row-key";
import { SPEC, T, writeRow } from "./db-tab-writers";

const MAX_ROW = SHEET_RANGES.dbManagement.maxRow;
const HEADER_ROW = SHEET_RANGES.dbManagement.headerRow;
// 실제 시트 검증(★★★세일즈PT 양식, 2026-05-06): 4채널 모두 1~3행 헤더, 4행~ 데이터.
const FIRST_DATA_ROW = HEADER_ROW + 1;

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
export function isSumRow(firstCellVal: unknown): boolean {
  if (typeof firstCellVal !== "string") return false;
  return firstCellVal.trim().startsWith("합계");
}

// ── 섹션 파서·인정필터·좌표 (R2-5 DB read 재사용을 위해 named export) ─────────
// 각 parseXRow(상대배열 r[0..]) 는 readSection 콜백과 backfill 열문자 복원 양쪽에서 공용.
// backfill 절대 열문자 시작 인덱스(A=0): 매입DB=B(1)·직접생산=I(8)·현수막=P(15)·콜지기소=X(23).
export const DB_SECTIONS = {
  매입DB: { keyPrefix: "매입DB", absStart: 1 },
  직접생산: { keyPrefix: "직접생산", absStart: 8 },
  현수막: { keyPrefix: "현수막", absStart: 15 },
  콜지기소: { keyPrefix: "콜지기소", absStart: 23 },
} as const;

export const parsePurchaseRow = (r: unknown[]): DBPurchase => {
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
};
export const isPurchaseMeaningful = (p: DBPurchase): boolean => isISODate(p.구매일);

export const parseProductionRow = (r: unknown[]): DBProduction => {
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
};
export const isProductionMeaningful = (p: DBProduction): boolean => isISODate(p.시작일);

export const parseBannerRow = (r: unknown[]): DBBanner => {
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
};
export const isBannerMeaningful = (b: DBBanner): boolean => isISODate(b.날짜);

export const parseLeadRow = (r: unknown[]): DBLead => ({
  구분: toStr(r[0]),
  접수일: serialToISODate(r[1]),
  대표자명: toStr(r[2]),
  업체명: toStr(r[3]),
  소개처: toStr(r[4]),
  연락처: toStr(r[5]),
  조건: toStr(r[6]),
});
export const isLeadMeaningful = (l: DBLead): boolean =>
  Boolean(l.대표자명) || Boolean(l.업체명) || Boolean(l.연락처);

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

// 매입DB (B:H). 파서·필터는 parsePurchaseRow/isPurchaseMeaningful (R2-5 공용).
export async function readPurchases(spreadsheetId: string) {
  return readSection<DBPurchase>(spreadsheetId, "B", "H", parsePurchaseRow, isPurchaseMeaningful);
}

// 직접생산 (I:O). J=날짜면 신규 레이아웃(parseProductionRow 내부 분기).
export async function readProductions(spreadsheetId: string) {
  return readSection<DBProduction>(spreadsheetId, "I", "O", parseProductionRow, isProductionMeaningful);
}

// 현수막 (P:W). U=boolean 신규 / 구 W fallback (parseBannerRow).
export async function readBanners(spreadsheetId: string) {
  return readSection<DBBanner>(spreadsheetId, "P", "W", parseBannerRow, isBannerMeaningful);
}

// 콜·지·기·소 (X:AD). 대표자명 OR 업체명 OR 연락처 하나는 있어야 인정.
export async function readLeads(spreadsheetId: string) {
  return readSection<DBLead>(spreadsheetId, "X", "AD", parseLeadRow, isLeadMeaningful);
}

// ── 저비용 존재확인 (BBE-259, BBE-248/#824 이식) ──────────────────
// 목록조회가 각 섹션의 전체 열 대신, "의미있음" 판정에 필요한 최소 열만 읽어 채워진 row 번호
// 집합을 얻는다 — DB row 집합과 대조해 빈틈(append 미러 실패로 누락된 신규행) 없으면 전체
// union 백필을 생략할 수 있다(정합성은 100% 유지, probabilistic 아님). 매입DB·직접생산·현수막은
// 판정 열이 섹션 시작열 1개뿐이라 절감폭이 크다(7~8열→1열). 콜·지·기·소는 판정에 3개 열
// (대표자명·업체명·연락처)이 흩어져 있어 X:AC(6열)까지 읽어야 해 절감폭이 작다(7열→6열,
// 정직 명기 — §0.8).
async function readPresenceRows(
  spreadsheetId: string,
  probeStartCol: string,
  probeEndCol: string,
  isPhantom: (r: unknown[]) => boolean,
  firstDataRow: number = FIRST_DATA_ROW,
): Promise<Set<number>> {
  const range = `${T}!${probeStartCol}${firstDataRow}:${probeEndCol}${MAX_ROW}`;
  const res = await sheetsClient().spreadsheets.values.get({ spreadsheetId, range });
  const values = (res.data.values ?? []) as unknown[][];
  const rows = new Set<number>();
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    if (isSumRow(r[0])) continue;
    if (!isPhantom(r)) rows.add(firstDataRow + i);
  }
  return rows;
}

export async function readPurchaseFilledRows(spreadsheetId: string): Promise<Set<number>> {
  return readPresenceRows(spreadsheetId, "B", "B", phantomPurchase);
}
export async function readProductionFilledRows(spreadsheetId: string): Promise<Set<number>> {
  return readPresenceRows(spreadsheetId, "I", "I", phantomProduction);
}
export async function readBannerFilledRows(spreadsheetId: string): Promise<Set<number>> {
  return readPresenceRows(spreadsheetId, "P", "P", phantomBanner);
}
export async function readLeadFilledRows(spreadsheetId: string): Promise<Set<number>> {
  return readPresenceRows(spreadsheetId, "X", "AC", phantomLead);
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
  // BBE-59: UUID 키(행번호 무관) + _row 명시 — db/row-key.ts 헤더 참고.
  // BBE-259: mirror.ts 표준보다 재시도창을 늘린 전용 durable 미러(#824 이식) — 동기 throw 는
  // 재시도 시 findFirstEmptyRow 가 새 행에 중복 기재(매출 이중계상)라 여전히 금지.
  mirrorDbTabRowDurable(spreadsheetId, mintRowKey("매입DB"), { ...p, _row: row, _cleared: false });
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
  // BBE-59: UUID 키(행번호 무관) + _row 명시 — db/row-key.ts 헤더 참고. BBE-259: durable 미러(위 참고).
  mirrorDbTabRowDurable(spreadsheetId, mintRowKey("직접생산"), { ...p, _row: row, _cleared: false });
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
  // BBE-59: UUID 키(행번호 무관) + _row 명시 — db/row-key.ts 헤더 참고. BBE-259: durable 미러(위 참고).
  mirrorDbTabRowDurable(spreadsheetId, mintRowKey("현수막"), { ...b, _row: row, _cleared: false });
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
  // BBE-59: UUID 키(행번호 무관) + _row 명시 — db/row-key.ts 헤더 참고. BBE-259: durable 미러(위 참고).
  mirrorDbTabRowDurable(spreadsheetId, mintRowKey("콜지기소"), { ...l, _row: row, _cleared: false });
  return { row };
}

// ── update/clear (특정 row) ───────────────────────────────────
// db-write.ts 로 분리(500줄 캡 — BBE-59 UUID 키 발급 추가로 이 파일이 캡 초과, db-production-cell.ts
// 와 같은 이유). append 는 findFirstEmptyRow(행번호 발급)와 묶여 있어 이 파일에 남는다.
export {
  updatePurchase,
  updateProduction,
  updateBanner,
  updateLead,
  clearPurchase,
  clearProduction,
  clearBanner,
  clearLead,
} from "./db-write";

export { writeProductionCountCell } from "./db-production-cell";
