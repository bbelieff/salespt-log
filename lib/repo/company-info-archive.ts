/**
 * Layer: repo — `06 업체정보` 탭 (계약 고객 동기화 표, consultation-log §1-2).
 *
 * 계약 액션 시 04 업체정보(T~AN) 스냅샷 1행 추가, 이후 04 변경 시 같은 키 행 동기화.
 * 키 = 계약ref(`${계약일}|${업체명}`, 05 contractRef 와 동일 포맷). 04 가 SSOT.
 *
 * 컬럼 (A~AB, sheet-structure §5-3): A=업체명 B=계약일 C=계약ref D=갱신시각
 * E~X=COMPANY_FIELDS 20필드 미러 Y=커스텀 JSON Z~AB=확장 3필드 미러(04 AQ~AS).
 *
 * §2.5 가드: append 는 A열 빈 행 탐색 + 그 행 FORMULA pre-read 로 raw 값 있으면
 * 다음 빈 행 재탐색(타 데이터 덮어쓰기 방지). update 는 자기 키(계약ref) 행만 타격.
 */
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { SHEET_RANGES } from "@/config";
import { COMPANY_FIELDS, COMPANY_FIELDS_EXT } from "./meetings";
import { CompanyInfo } from "@/types";
import { mirrorSheetRow, mirrorClearRow } from "./db/mirror";

const TAB = SHEET_RANGES.companyInfoArchive.tab;
const HEADER_RANGE = `'${TAB}'!${SHEET_RANGES.companyInfoArchive.headerRow}`;
const KEY_COL_RANGE = `'${TAB}'!C2:C`; // 계약ref 검색용
const ID_COL_RANGE = `'${TAB}'!A2:A`; // 빈 행 탐색용

// A~Y(기존 25) + Z~AB(확장 3 미러 — 04 AQ~AS, field-grid). 커스텀(Y) 뒤 append.
const HEADER = [
  [
    "업체명", "계약일", "계약ref", "갱신시각",
    ...COMPANY_FIELDS, "업체정보_커스텀", ...COMPANY_FIELDS_EXT,
  ],
];

/** 계약ref 합성키 — 05 contractRef 와 동일 포맷. */
export function companyContractRef(계약일: string, 업체명: string): string {
  return `${계약일}|${업체명.trim()}`;
}

/** (업체명·계약일·업체정보) → 06 1행 배열 (A~AB, 28컬럼). 순수 — 테스트 대상. */
export function companyInfoToArchiveRow(
  업체명: string,
  계약일: string,
  ci: CompanyInfo | undefined,
  nowISO: string,
): string[] {
  const c = (ci ?? {}) as Record<string, unknown>;
  const toCell = (f: string) => {
    const v = String(c[f] ?? "").trim();
    return v ? `'${v}` : ""; // plain text 강제 (USER_ENTERED 오변환 방지)
  };
  const custom = ci?.커스텀 ? JSON.stringify(ci.커스텀) : "";
  return [
    업체명.trim(),
    계약일,
    companyContractRef(계약일, 업체명),
    nowISO,
    ...COMPANY_FIELDS.map(toCell),
    custom && custom !== "{}" ? `'${custom}` : "",
    ...COMPANY_FIELDS_EXT.map(toCell), // Z~AB (04 AQ~AS 미러)
  ];
}

// ── 탭 자동 생성 (todos.ts ensureTodoTab 동일 패턴 — promise 캐시로 TOCTOU 직렬화) ──
const ensuring = new Map<string, Promise<void>>();

export function ensureCompanyInfoTab(spreadsheetId: string): Promise<void> {
  let p = ensuring.get(spreadsheetId);
  if (!p) {
    p = doEnsure(spreadsheetId).catch((e) => {
      ensuring.delete(spreadsheetId);
      throw e;
    });
    ensuring.set(spreadsheetId, p);
  }
  return p;
}

async function doEnsure(spreadsheetId: string): Promise<void> {
  const meta = await sheetsClient().spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === TAB);
  if (!exists) {
    try {
      await sheetsClient().spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
      });
    } catch {
      /* 동시 생성 — 이미 존재로 간주 */
    }
  }
  // addSheet 기본 26열(Z) — AB(28)까지 grid 보장 (field-grid).
  await ensureGridColumns(spreadsheetId, TAB, 28);
  const header = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: HEADER_RANGE,
  });
  const cells = header.data.values?.[0] ?? [];
  if (!cells[0]) {
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId,
      range: HEADER_RANGE,
      valueInputOption: "RAW",
      requestBody: { values: HEADER },
    });
  } else if (!String(cells[25] ?? "").trim()) {
    // 확장 전(25컬럼) 기존 탭 — Z1:AB1 라벨만 보강 (빈 셀에만, §2.5)
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId,
      range: `'${TAB}'!Z1:AB1`,
      valueInputOption: "RAW",
      requestBody: { values: [[...COMPANY_FIELDS_EXT]] },
    });
  }
}

/** 계약ref 로 기존 행 번호(1-based) 찾기. 없으면 null. */
async function findRowByRef(
  spreadsheetId: string,
  ref: string,
): Promise<number | null> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: KEY_COL_RANGE,
  });
  const refs = (res.data.values ?? []).map((r) => String(r[0] ?? "").trim());
  const i = refs.findIndex((v) => v === ref);
  return i >= 0 ? i + 2 : null;
}

/** §2.5 append 가드 — A열 빈 행 후보를 FORMULA pre-read, raw 잔존값 있으면 다음 행. */
async function findSafeEmptyRow(spreadsheetId: string): Promise<number> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: ID_COL_RANGE,
  });
  const ids = (res.data.values ?? []).map((r) => String(r[0] ?? "").trim());
  let candidate = ids.length + 2;
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) {
      candidate = i + 2;
      break;
    }
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const row = candidate + attempt;
    const pre = await sheetsClient().spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB}'!A${row}:AB${row}`,
      valueRenderOption: "FORMULA",
    });
    const cells = pre.data.values?.[0] ?? [];
    const hasRaw = cells.some((c) => {
      const s = String(c ?? "").trim();
      return s !== "" && !s.startsWith("=");
    });
    if (!hasRaw) return row;
  }
  throw new Error("[company-info-archive] 빈 행 탐색 실패 (10행 연속 raw 잔존)");
}

/**
 * 계약 고객 업체정보 upsert — 키(계약ref) 행 있으면 갱신(동기화), 없으면 append(스냅샷).
 * 04 변경 동기화·계약 액션 적재 양쪽이 이 함수 하나를 사용.
 */
export async function upsertCompanyInfoArchive(
  spreadsheetId: string,
  data: { 업체명: string; 계약일: string; 업체정보?: CompanyInfo },
): Promise<{ row: number; created: boolean }> {
  await ensureCompanyInfoTab(spreadsheetId);
  const ref = companyContractRef(data.계약일, data.업체명);
  const rowValues = companyInfoToArchiveRow(
    data.업체명,
    data.계약일,
    data.업체정보,
    new Date().toISOString(),
  );
  const existing = await findRowByRef(spreadsheetId, ref);
  const row = existing ?? (await findSafeEmptyRow(spreadsheetId));
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `'${TAB}'!A${row}:AB${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowValues] },
  });
  // P1 미러 — 키 = 계약ref(C열 값).
  mirrorSheetRow({
    spreadsheetId,
    tab: "company_archive",
    rowKey: ref,
    payload: { 업체명: data.업체명, 계약일: data.계약일, ...(data.업체정보 ?? {}) },
  });
  return { row, created: existing === null };
}

/** 06 키 행의 업체정보 읽기 — payment 카드 표시용. 행 없으면 null. */
export async function readCompanyInfoArchiveRow(
  spreadsheetId: string,
  계약일: string,
  업체명: string,
): Promise<CompanyInfo | null> {
  await ensureCompanyInfoTab(spreadsheetId);
  const row = await findRowByRef(spreadsheetId, companyContractRef(계약일, 업체명));
  if (row === null) return null;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `'${TAB}'!E${row}:AB${row}`,
  });
  const r = res.data.values?.[0] ?? [];
  const ci: Record<string, unknown> = {};
  COMPANY_FIELDS.forEach((f, i) => {
    ci[f] = String(r[i] ?? "").trim();
  });
  COMPANY_FIELDS_EXT.forEach((f, i) => {
    ci[f] = String(r[COMPANY_FIELDS.length + 1 + i] ?? "").trim(); // Z~AB
  });
  const raw = String(r[COMPANY_FIELDS.length] ?? "").trim();
  if (raw) {
    try {
      ci.커스텀 = JSON.parse(raw);
    } catch {
      /* 손상 JSON 무시 */
    }
  }
  const parsed = CompanyInfo.safeParse(ci);
  return parsed.success ? parsed.data : null;
}

/** 계약ref 행 존재 여부 — patchMeeting 동기화 가드(계약 고객만 06 갱신). */
export async function hasCompanyInfoArchiveRow(
  spreadsheetId: string,
  계약일: string,
  업체명: string,
): Promise<boolean> {
  try {
    await ensureCompanyInfoTab(spreadsheetId);
    return (
      (await findRowByRef(spreadsheetId, companyContractRef(계약일, 업체명))) !==
      null
    );
  } catch {
    return false;
  }
}

/**
 * 06 키 행 재키 — 계약 업체명·계약일 변경 시 A(업체명)/B(계약일)/C(계약ref)/D(갱신시각)만 갱신.
 * E~AB 업체정보 스냅샷은 보존(중복 행 생성·고아 방지). old 키 행 없으면 no-op.
 */
export async function renameCompanyInfoKey(
  spreadsheetId: string,
  oldKey: { 계약일: string; 업체명: string },
  next: { 계약일: string; 업체명: string },
): Promise<{ moved: boolean }> {
  await ensureCompanyInfoTab(spreadsheetId);
  const row = await findRowByRef(
    spreadsheetId,
    companyContractRef(oldKey.계약일, oldKey.업체명),
  );
  if (row === null) return { moved: false };
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `'${TAB}'!A${row}:D${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          next.업체명.trim(),
          next.계약일,
          companyContractRef(next.계약일, next.업체명),
          new Date().toISOString(),
        ],
      ],
    },
  });
  // P1 미러 — 키 이동: old ref 는 _cleared, new ref 로 키 필드 병합(스냅샷은 시트 보존).
  mirrorClearRow({
    spreadsheetId,
    tab: "company_archive",
    rowKey: companyContractRef(oldKey.계약일, oldKey.업체명),
  });
  mirrorSheetRow({
    spreadsheetId,
    tab: "company_archive",
    rowKey: companyContractRef(next.계약일, next.업체명),
    payload: { _cleared: false, 업체명: next.업체명.trim(), 계약일: next.계약일 },
  });
  return { moved: true };
}
