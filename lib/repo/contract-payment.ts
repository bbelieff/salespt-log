/**
 * Layer: repo — 02 계약수납관리 시트 I/O (v2: 30컬럼 A~AD).
 *
 * 1행 = 그룹 헤더, 2행 = 필드 헤더, 3행~ = 데이터.
 * 컬럼 매핑 (SSOT: docs/domains/sheet-structure.md §4 v2):
 *   A: 공란
 *   B: 순번 (자동 — read만, append 시 Sheet rows 인덱스 그대로)
 *   C: 계약일       D: 업체명       E: 수임비          (자동 연동, 04 업체관리 D/G/L에서)
 *   F~L: 체크박스 7개 ("ㅇ"/"" 표기, true→"ㅇ" / false→"")
 *        공동인증서/임대차계약서/신분증/드라이브업로드/사업계획서초안발송/컨설팅5종서류발송/플러그이관
 *   M~R: 수납1 (진행기관/진행률/현황/승인금액/수납액/수납일)
 *   S~X: 수납2
 *   Y~AD: 수납3
 *   진행률 컬럼(N/T/Z): 시트 data validation = "0%/20%/40%/60%/80%/100%" 텍스트 dropdown
 *
 * 가드레일:
 *   • 1행·2행(헤더)은 절대 쓰지 않음 — append/update는 row≥3.
 *   • B(순번)는 시트 수식 또는 사용자가 직접 — 앱은 빈 문자열 send.
 *   • 수수료는 별도 컬럼이 아니라 Q+W+AC(슬롯별 승인금액 합)의 클라이언트 파생값.
 */
import { SHEET_RANGES } from "@/config";
import { ContractPayment, type PaymentSlot, Progress } from "@/types";
import { sheetsClient } from "./sheets-client";

const CFG = SHEET_RANGES.contractPayment;

/**
 * 02 계약수납 탭 alias.
 * 7기 양식: `02 계약수납관리` (R1=비고, R2~R5=헤더+예시, R6~ 실데이터)
 * 6기 양식: `02 계약관리`   (R1~R4=헤더+예시, R5~ 실데이터)
 * 두 양식의 컬럼 의미·순서는 완전 동일 — 첫 데이터 행 위치만 1 시프트.
 */
const TAB_ALIASES: ReadonlyArray<{ tab: string; firstDataRow: number }> = [
  { tab: CFG.tab, firstDataRow: CFG.firstDataRow }, // 7기 (코드 기본)
  { tab: "02 계약관리", firstDataRow: 5 },           // 6기 (legacy)
];

const layoutCache = new Map<string, { tab: string; firstDataRow: number }>();

/**
 * spreadsheetId 의 02 탭 layout 동적 결정.
 * 시트 메타 1회 조회 후 in-process Map 캐시 (프로세스 lifetime).
 */
async function resolveLayout(
  spreadsheetId: string,
): Promise<{ tab: string; firstDataRow: number }> {
  const cached = layoutCache.get(spreadsheetId);
  if (cached) return cached;
  const meta = await sheetsClient().spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });
  const titles = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""),
  );
  for (const alias of TAB_ALIASES) {
    if (titles.has(alias.tab)) {
      layoutCache.set(spreadsheetId, alias);
      return alias;
    }
  }
  // 둘 다 없으면 기본값 — 호출 시 sheets API 가 에러로 알려줌.
  const fallback = TAB_ALIASES[0]!;
  layoutCache.set(spreadsheetId, fallback);
  return fallback;
}

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

/** 체크박스 write — true→"ㅇ", false→"". 시트의 한글 표기 유지. */
function boolToCheck(b: boolean): string {
  return b ? "ㅇ" : "";
}

/** 진행률 read — 시트 셀이 "100%"/"60%" 텍스트 또는 숫자(0.6)일 수 있음.
 *  Progress enum 값으로 정규화. unmatched는 빈 문자열로. */
function toProgress(v: unknown): Progress {
  if (typeof v === "number" && Number.isFinite(v)) {
    // 0~1 범위 (셀 서식 = 백분율) 또는 0~100 범위 모두 허용
    const pct = v <= 1 ? Math.round(v * 100) : Math.round(v);
    const candidate = `${pct}%`;
    const parsed = Progress.safeParse(candidate);
    return parsed.success ? parsed.data : "";
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return "";
    // "100%" 그대로 일치
    const parsed = Progress.safeParse(s);
    if (parsed.success) return parsed.data;
    // "100" → "100%" 보정
    const numOnly = Progress.safeParse(`${s}%`);
    if (numOnly.success) return numOnly.data;
    return "";
  }
  return "";
}

// ── A~AD 한 행을 ContractPayment 객체로 ───────────────────────
function rowToCP(r: unknown[], rowNumber: number): ContractPayment | null {
  // C/D/E (계약일/업체명/수임비) 중 하나라도 의미있게 채워진 row만 인정.
  // 시트에 미리 박혀있는 F~L 체크박스 data validation의 기본값(FALSE)이나
  // M~AD 슬롯의 default 0 으로는 row 인정 X — "(업체명 없음)" phantom row 방지.
  // (round-trip 검증에서 발견된 이슈 — fix/contract-payment-empty-rows)
  const 계약일Cell = toStr(r[2]).trim();
  const 업체명Cell = toStr(r[3]).trim();
  const 수임비Cell = toNum(r[4]);
  const hasMeaningfulContent =
    계약일Cell !== "" || 업체명Cell !== "" || 수임비Cell > 0;
  if (!hasMeaningfulContent) return null;

  // 컬럼 인덱스 (A=0, B=1, C=2, ..., AA=26, AD=29)
  // v2 슬롯: M=12 / S=18 / Y=24, 각 6필드.
  const slot = (start: number): PaymentSlot => ({
    진행기관: toStr(r[start]),
    진행률: toProgress(r[start + 1]),
    현황: toStr(r[start + 2]),
    승인금액: toNum(r[start + 3]),
    수납액: toNum(r[start + 4]),
    수납일: serialToISODate(r[start + 5]),
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
    수납1: slot(12), // M=12 (M~R)
    수납2: slot(18), // S=18 (S~X)
    수납3: slot(24), // Y=24 (Y~AD)
    // 2026-05-17 [4]: 추가 메모 필드 — AE=30, AF=31.
    로드맵메모: toStr(r[30]),
    메모사항: toStr(r[31]),
  });
  return parsed.success ? parsed.data : null;
}

// ── ContractPayment → A~AF 셀 배열 (32 컬럼, 2026-05-17 [4] 메모 추가) ─
function cpToRow(cp: ContractPayment): (string | number | boolean)[] {
  const out = new Array(32).fill(""); // A~AF = 32 컬럼
  // A 공란, B 순번 — 빈 문자열 (시트 자동 또는 사용자 책임)
  out[2] = cp.계약일;
  out[3] = cp.업체명;
  out[4] = cp.수임비;
  // F~L 체크박스 7개 — "ㅇ"/"" 표기
  out[5] = boolToCheck(cp.공동인증서);
  out[6] = boolToCheck(cp.임대차계약서);
  out[7] = boolToCheck(cp.신분증);
  out[8] = boolToCheck(cp.드라이브업로드);
  out[9] = boolToCheck(cp.사업계획서초안발송);
  out[10] = boolToCheck(cp.컨설팅5종서류발송);
  out[11] = boolToCheck(cp.플러그이관);
  // 수납1 (M~R = 12~17): 진행기관/진행률/현황/승인금액/수납액/수납일
  out[12] = cp.수납1.진행기관;
  out[13] = cp.수납1.진행률;
  out[14] = cp.수납1.현황;
  out[15] = cp.수납1.승인금액;
  out[16] = cp.수납1.수납액;
  out[17] = cp.수납1.수납일;
  // 수납2 (S~X = 18~23)
  out[18] = cp.수납2.진행기관;
  out[19] = cp.수납2.진행률;
  out[20] = cp.수납2.현황;
  out[21] = cp.수납2.승인금액;
  out[22] = cp.수납2.수납액;
  out[23] = cp.수납2.수납일;
  // 수납3 (Y~AD = 24~29)
  out[24] = cp.수납3.진행기관;
  out[25] = cp.수납3.진행률;
  out[26] = cp.수납3.현황;
  out[27] = cp.수납3.승인금액;
  out[28] = cp.수납3.수납액;
  out[29] = cp.수납3.수납일;
  // 2026-05-17 [4]: AE=30 로드맵메모, AF=31 메모사항.
  out[30] = cp.로드맵메모;
  out[31] = cp.메모사항;
  return out;
}

// ── Public API ─────────────────────────────────────────────────

/** 02 계약수납관리 모든 행 read (firstDataRow~). 7기·6기 양식 동시 지원. */
export async function readAll(spreadsheetId: string): Promise<ContractPayment[]> {
  const { tab, firstDataRow } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!A${firstDataRow}:AF`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = (res.data.values ?? []) as unknown[][];
  const out: ContractPayment[] = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    const cp = rowToCP(r, firstDataRow + i);
    if (cp) out.push(cp);
  }
  return out;
}

/**
 * 첫 빈 데이터 행 찾기 (A~AA 모두 빈 row).
 * append용 — 합계 행 없는 시트라 단순.
 */
async function findFirstEmptyRow(spreadsheetId: string): Promise<number> {
  const { tab, firstDataRow } = await resolveLayout(spreadsheetId);
  // C(계약일) 컬럼만 읽어서 빈 행 탐색 (자동 연동 필드라 데이터 행 식별 OK)
  const range = `${tabRef(tab)}!C${firstDataRow}:C`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const values = (res.data.values ?? []) as unknown[][];
  for (let i = 0; i < values.length; i++) {
    const v = values[i]?.[0];
    if (v === undefined || v === null || String(v).trim() === "") {
      return firstDataRow + i;
    }
  }
  return firstDataRow + values.length;
}

/**
 * (계약일, 업체명) 쌍으로 매칭되는 첫 row를 찾음. sync 업데이트용.
 * 같은 (계약일, 업체명)이 여러 row인 경우 가장 빠른(작은 row 번호) 것 반환.
 */
async function findRowByLink(
  spreadsheetId: string,
  계약일: string,
  업체명: string,
): Promise<number | null> {
  const { tab, firstDataRow } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!C${firstDataRow}:D`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = (res.data.values ?? []) as unknown[][];
  for (let i = 0; i < values.length; i++) {
    const r = values[i] ?? [];
    const cellDate = serialToISODate(r[0]);
    const cellName = toStr(r[1]).trim();
    if (cellDate === 계약일 && cellName === 업체명.trim()) {
      return firstDataRow + i;
    }
  }
  return null;
}

/**
 * 04 업체관리에서 수임비가 수정됐을 때, 매칭되는 02 계약수납관리 row의
 * E열(수임비)을 sync 업데이트. (계약일+업체명)으로 매칭.
 *
 * 매칭 row 없으면 null 반환 — 호출 측에서 fan-out으로 새 row 생성하거나
 * 사용자에게 안내 가능.
 */
export async function syncFeeFromContract(
  spreadsheetId: string,
  data: { 계약일: string; 업체명: string; 수임비: number },
): Promise<{ row: number } | null> {
  const row = await findRowByLink(spreadsheetId, data.계약일, data.업체명);
  if (!row) return null;
  const { tab } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!E${row}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[data.수임비]] },
  });
  return { row };
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
  const { tab } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!C${row}:E${row}`;
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

/** 사용자 입력 영역(F~AD) update — 한 row 통째로. */
export async function updateUserFields(
  spreadsheetId: string,
  cp: ContractPayment,
): Promise<void> {
  const validated = ContractPayment.parse(cp);
  if (!validated.row) {
    throw new Error("[contract-payment] row 번호 필수 (≥3)");
  }
  const fullRow = cpToRow(validated);
  // F~AF = idx 5~31 (27 columns: 7 체크박스 + 18 슬롯 필드 + 2 메모, 2026-05-17 [4])
  const userArea = fullRow.slice(5, 32);
  const { tab } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!F${validated.row}:AF${validated.row}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [userArea] },
  });
}

/** row 식별로 한 row clear (C~AD만 비움 — A 공란/B 순번 수식 보존).
 *
 *  버그 fix: 이전에는 A~AD 전체 clear → 사용자 시트의 B(순번) 수식까지
 *  지워버려 row 번호가 사라지는 문제 있었음. ARRAY 수식·순번 자동계산 보존.
 */
export async function clearRow(
  spreadsheetId: string,
  row: number,
): Promise<void> {
  const { tab, firstDataRow } = await resolveLayout(spreadsheetId);
  if (row < firstDataRow) {
    throw new Error(`[contract-payment] 헤더 행 보호: row ${row} clear 거부`);
  }
  const range = `${tabRef(tab)}!C${row}:AF${row}`;
  await sheetsClient().spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
}
