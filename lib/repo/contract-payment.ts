/**
 * Layer: repo — 02 계약수납관리 시트 I/O.
 *
 * 1행 = 그룹 헤더, 2행 = 필드 헤더, 3행~ = 데이터.
 * 컬럼 매핑 (SSOT: docs/domains/sheet-structure.md §4):
 *   A: 공란
 *   B: 순번 (자동 — read만, append 시 Sheet rows 인덱스 그대로)
 *   C: 계약일       D: 업체명       E: 수임비          (자동 연동, 계약 액션 시점)
 *   F~L: 체크박스 7개 (공동인증서/임대차계약서/신분증/드라이브업로드/사업계획서초안발송/컨설팅5종서류발송/플러그이관)
 *   M~Q: 수납1 (진행기관/현황/승인금액/수납액/수납일)
 *   R~V: 수납2
 *   W~AA: 수납3
 *
 * 가드레일:
 *   • 1행·2행(헤더)은 절대 쓰지 않음 — append/update는 row≥3.
 *   • B(순번)는 시트 수식 또는 사용자가 직접 — 앱은 빈 문자열 send.
 */
import { SHEET_RANGES } from "@/config";
import { ContractPayment, type PaymentSlot } from "@/types";
import { sheetsClient } from "./sheets-client";

const CFG = SHEET_RANGES.contractPayment;
const TAB = CFG.tab;
const FIRST_DATA_ROW = CFG.firstDataRow;
const RANGE_ALL = `${tabRef(TAB)}!A${FIRST_DATA_ROW}:AA`;

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

// ── 시트 직렬값 ↔ 표시값 변환 ──────────────────────────────────
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
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "y" || s === "ㅇ" || s === "1" || s === "✓") return true;
    return false;
  }
  if (typeof v === "number") return v !== 0;
  return false;
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

// ── A~AA 한 행을 ContractPayment 객체로 ───────────────────────
function rowToCP(r: unknown[], rowNumber: number): ContractPayment | null {
  // 모든 셀이 비어있으면 skip
  const hasContent = r.some(
    (c) => c !== undefined && c !== null && String(c).trim() !== "",
  );
  if (!hasContent) return null;

  // 컬럼 인덱스 (A=0, B=1, C=2, ..., AA=26)
  const slot = (start: number): PaymentSlot => ({
    진행기관: toStr(r[start]),
    현황: toStr(r[start + 1]),
    승인금액: toNum(r[start + 2]),
    수납액: toNum(r[start + 3]),
    수납일: serialToISODate(r[start + 4]),
  });

  const parsed = ContractPayment.safeParse({
    row: rowNumber,
    계약일: serialToISODate(r[2]),
    업체명: toStr(r[3]),
    수임비: toNum(r[4]),
    공동인증서: toBool(r[5]),
    임대차계약서: toBool(r[6]),
    신분증: toBool(r[7]),
    드라이브업로드: toBool(r[8]),
    사업계획서초안발송: toBool(r[9]),
    컨설팅5종서류발송: toBool(r[10]),
    플러그이관: toBool(r[11]),
    수납1: slot(12), // M=12
    수납2: slot(17), // R=17
    수납3: slot(22), // W=22
  });
  return parsed.success ? parsed.data : null;
}

// ── ContractPayment → A~AA 셀 배열 ────────────────────────────
function cpToRow(cp: ContractPayment): (string | number | boolean)[] {
  const out = new Array(27).fill(""); // A~AA
  // A 공란, B 순번 — 빈 문자열 (시트 자동 또는 사용자 책임)
  out[2] = cp.계약일;
  out[3] = cp.업체명;
  out[4] = cp.수임비;
  out[5] = cp.공동인증서;
  out[6] = cp.임대차계약서;
  out[7] = cp.신분증;
  out[8] = cp.드라이브업로드;
  out[9] = cp.사업계획서초안발송;
  out[10] = cp.컨설팅5종서류발송;
  out[11] = cp.플러그이관;
  // 수납1 (M~Q = 12~16)
  out[12] = cp.수납1.진행기관;
  out[13] = cp.수납1.현황;
  out[14] = cp.수납1.승인금액;
  out[15] = cp.수납1.수납액;
  out[16] = cp.수납1.수납일;
  // 수납2 (R~V = 17~21)
  out[17] = cp.수납2.진행기관;
  out[18] = cp.수납2.현황;
  out[19] = cp.수납2.승인금액;
  out[20] = cp.수납2.수납액;
  out[21] = cp.수납2.수납일;
  // 수납3 (W~AA = 22~26)
  out[22] = cp.수납3.진행기관;
  out[23] = cp.수납3.현황;
  out[24] = cp.수납3.승인금액;
  out[25] = cp.수납3.수납액;
  out[26] = cp.수납3.수납일;
  return out;
}

// ── Public API ─────────────────────────────────────────────────

/** 02 계약수납관리 모든 행 read (3행~). */
export async function readAll(spreadsheetId: string): Promise<ContractPayment[]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE_ALL,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = (res.data.values ?? []) as unknown[][];
  const out: ContractPayment[] = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    const cp = rowToCP(r, FIRST_DATA_ROW + i);
    if (cp) out.push(cp);
  }
  return out;
}

/**
 * 첫 빈 데이터 행 찾기 (A~AA 모두 빈 row).
 * append용 — 합계 행 없는 시트라 단순.
 */
async function findFirstEmptyRow(spreadsheetId: string): Promise<number> {
  // C(계약일) 컬럼만 읽어서 빈 행 탐색 (자동 연동 필드라 데이터 행 식별 OK)
  const range = `${tabRef(TAB)}!C${FIRST_DATA_ROW}:C`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const values = (res.data.values ?? []) as unknown[][];
  for (let i = 0; i < values.length; i++) {
    const v = values[i]?.[0];
    if (v === undefined || v === null || String(v).trim() === "") {
      return FIRST_DATA_ROW + i;
    }
  }
  return FIRST_DATA_ROW + values.length;
}

/**
 * 계약 액션 시 자동 호출: 새 row append (C/D/E만 채움, F~AA는 빈 값).
 * 사용자는 계약수납탭에서 추가 입력.
 */
export async function appendFromContract(
  spreadsheetId: string,
  data: { 계약일: string; 업체명: string; 수임비: number },
): Promise<{ row: number }> {
  const row = await findFirstEmptyRow(spreadsheetId);
  const range = `${tabRef(TAB)}!C${row}:E${row}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[data.계약일, data.업체명, data.수임비]],
    },
  });
  return { row };
}

/** 사용자 입력 영역(F~AA) update — 한 row 통째로. */
export async function updateUserFields(
  spreadsheetId: string,
  cp: ContractPayment,
): Promise<void> {
  const validated = ContractPayment.parse(cp);
  if (!validated.row) {
    throw new Error("[contract-payment] row 번호 필수 (≥3)");
  }
  const fullRow = cpToRow(validated);
  // F~AA = idx 5~26
  const userArea = fullRow.slice(5, 27);
  const range = `${tabRef(TAB)}!F${validated.row}:AA${validated.row}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [userArea] },
  });
}

/** row 식별로 한 row clear (A~AA 모두 비움). */
export async function clearRow(
  spreadsheetId: string,
  row: number,
): Promise<void> {
  if (row < FIRST_DATA_ROW) {
    throw new Error(`[contract-payment] 헤더 행 보호: row ${row} clear 거부`);
  }
  const range = `${tabRef(TAB)}!A${row}:AA${row}`;
  await sheetsClient().spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
}
