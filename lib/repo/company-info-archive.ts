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
import { captureServerEvent } from "@/lib/analytics/api-timing";
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { SHEET_RANGES } from "@/config";
import { COMPANY_FIELDS, COMPANY_FIELDS_EXT } from "./meetings";
import { CompanyInfo } from "@/types";
import { dbEnabled } from "./db/client";
import {
  clearMirrorPending,
  listMirrorPending,
  markMirrorPending,
} from "./db/mirror-pending";
import {
  persistCompanyArchiveRow,
  persistCompanyArchiveRename,
  readCompanyArchiveRowPayload,
  type CompanyArchiveWriteOpts,
} from "./db/company-archive-sync";

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

// ── 시트 수렴 동기화 (R7-#11 BBE-60 — DB 정본 경로 전용, meetings-write.ts 패턴 이식) ──
// 스코프: upsertCompanyInfoArchive(생성·갱신)만. renameCompanyInfoKey(개명)는 제외 —
// 시트의 rename 은 "같은 물리행의 A:D 만 갈아끼우고 E:AB 컨텐츠는 그대로 둔다"는 의미론이라
// (upsertArchiveRowWithRetry 처럼 새 키에 컨텐츠를 통째로 다시 쓰는 구조가 아님), 이걸 비동기
// 수렴잡으로 옮기려면 old/new 키 양쪽에 컨텐츠 캐리오버를 DB 에 새로 설계해야 한다(#559·
// 2026-07-14 사고 2건이 이미 이 파일의 "부활" 함정을 보여줌 — 섣부른 재설계 금지).
// rename 은 기존 dual-sync(A안, R3-3 PR-2)를 그대로 유지 — 시트 동기 inline + DB 동기/미러.
const sheetSyncTails = new Map<string, Promise<void>>();

/** DB upsert 성공 후 호출 — 해당 계약ref 행을 최신 DB 상태로 시트에 수렴(find-or-append). */
function queueCompanyArchiveSheetSync(spreadsheetId: string, rowKey: string): void {
  const tail = (sheetSyncTails.get(spreadsheetId) ?? Promise.resolve())
    .then(() => runSheetSync(spreadsheetId, rowKey))
    .then(() => drainPendingCompanyArchiveSheet(spreadsheetId, rowKey))
    .catch(() => {}); // runSheetSync 가 실패를 계수 — 큐는 항상 전진
  sheetSyncTails.set(spreadsheetId, tail);
  void tail.finally(() => {
    if (sheetSyncTails.get(spreadsheetId) === tail) sheetSyncTails.delete(spreadsheetId);
  });
}

/** 1행 수렴 동기화 — 최신 DB 상태 기준. 선형 백오프 3회.
 * 성공 → mirror_pending 해제. 최종 실패 → mirror_pending 마킹 + 계수(§2.2·§7-3 동일 정책). */
async function runSheetSync(spreadsheetId: string, rowKey: string): Promise<void> {
  const ref = { spreadsheetId, tab: "company_archive" as const, rowKey };
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await syncCompanyArchiveRowToSheet(spreadsheetId, rowKey);
      await clearMirrorPending(ref).catch(() => {});
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  await markMirrorPending(ref).catch(() => {});
  console.warn(
    `[company-info-archive] 시트 수렴 실패 key=${rowKey}: ${lastErr instanceof Error ? lastErr.message : lastErr}`,
  );
  captureServerEvent("sheet_mirror_error", { tab: "company_archive" });
}

/** 1회 시트 반영(최신 DB 상태) — 실패 시 throw(runSheetSync 가 재시도·표식 관리).
 * DB 행이 없거나 rename 으로 지워졌으면(_cleared) 반영할 정본이 없음 — no-op. */
async function syncCompanyArchiveRowToSheet(spreadsheetId: string, rowKey: string): Promise<void> {
  const payload = await readCompanyArchiveRowPayload(spreadsheetId, rowKey);
  if (!payload || payload._cleared) return;
  await ensureCompanyInfoTab(spreadsheetId);
  const existing = await findRowByRef(spreadsheetId, rowKey);
  const row = existing ?? (await findSafeEmptyRow(spreadsheetId));
  const 업체명 = String(payload["업체명"] ?? "").trim();
  const 계약일 = String(payload["계약일"] ?? "").trim();
  const rowValues = companyInfoToArchiveRow(
    업체명,
    계약일,
    payload as unknown as CompanyInfo,
    new Date().toISOString(),
  );
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `'${TAB}'!A${row}:AB${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [rowValues] },
  });
}

/** self-heal: 같은 시트의 밀린(mirror_pending) 06 행을 재드라이브. 1회 최대 25행. */
async function drainPendingCompanyArchiveSheet(
  spreadsheetId: string,
  justSyncedKey: string,
): Promise<void> {
  if (!dbEnabled()) return;
  const keys = await listMirrorPending(spreadsheetId, "company_archive", 25).catch(() => []);
  for (const key of keys) {
    if (key === justSyncedKey) continue;
    await runSheetSync(spreadsheetId, key);
  }
}

/**
 * 계약 고객 업체정보 upsert — 키(계약ref) 행 있으면 갱신(동기화), 없으면 append(스냅샷).
 * 04 변경 동기화·계약 액션 적재 양쪽이 이 함수 하나를 사용.
 *
 * R7-#11(BBE-60) 진짜 flip: 파일럿(opts.syncDb) 은 **DB 동기 정본**(실패=throw) 먼저 쓰고
 * 시트는 큐잉된 비동기 수렴 잡에 맡긴다 — db-write-flip §2 목표(시트 왕복 제거)를 이 upsert
 * 경로에서 달성. 비파일럿은 R2 그대로(시트 동기 정본 + DB 비동기 미러, 완전 불변·롤백 스위치).
 * 반환값의 row/created 는 **파일럿에서는 시트 미반영 시점이라 의미 없음**(-1/false 고정) —
 * 기존 3개 호출부(contact.ts·contract-payment.ts·contract-payment-add.ts) 모두 반환값 미사용 확인.
 */
export async function upsertCompanyInfoArchive(
  spreadsheetId: string,
  data: { 업체명: string; 계약일: string; 업체정보?: CompanyInfo },
  opts?: CompanyArchiveWriteOpts,
): Promise<{ row: number; created: boolean }> {
  const ref = companyContractRef(data.계약일, data.업체명);
  const payload = { 업체명: data.업체명, 계약일: data.계약일, ...(data.업체정보 ?? {}) };

  if (opts?.syncDb) {
    await persistCompanyArchiveRow(spreadsheetId, ref, payload, opts);
    queueCompanyArchiveSheetSync(spreadsheetId, ref);
    return { row: -1, created: false };
  }

  await ensureCompanyInfoTab(spreadsheetId);
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
  // 비파일럿=R2 미러(async). opts 생략 호출(비파일럿 기본 경로)도 동일.
  await persistCompanyArchiveRow(spreadsheetId, ref, payload, opts);
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

/**
 * 계약ref 행 존재 여부 — patchMeeting 동기화 가드(계약 고객만 06 갱신).
 *
 * opts.fromDb(파일럿, R7-#11 BBE-60): DB 를 먼저 확인 — upsertCompanyInfoArchive 가
 * 파일럿에서 시트를 비동기 큐로 미루므로, 직후 이 함수를 시트로만 확인하면 아직 수렴
 * 전인 행을 "없음"으로 오판하는 read-your-writes 위반이 난다(R3-2 §6 교훈 재적용).
 * DB 에 있으면 즉시 true. DB 공백·실패는 기존 시트 확인으로 self-heal(안 바뀜).
 */
export async function hasCompanyInfoArchiveRow(
  spreadsheetId: string,
  계약일: string,
  업체명: string,
  opts?: { fromDb?: boolean },
): Promise<boolean> {
  const ref = companyContractRef(계약일, 업체명);
  if (opts?.fromDb) {
    try {
      const payload = await readCompanyArchiveRowPayload(spreadsheetId, ref);
      if (payload && !payload._cleared) return true;
    } catch {
      /* DB 실패 — 아래 시트 확인으로 폴백 */
    }
  }
  try {
    await ensureCompanyInfoTab(spreadsheetId);
    return (await findRowByRef(spreadsheetId, ref)) !== null;
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
  opts?: CompanyArchiveWriteOpts,
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
  // 키 이동: old ref 는 _cleared, new ref 로 키 필드 병합(스냅샷은 시트 보존).
  // 파일럿=둘 다 DB 동기(실패=throw), 비파일럿=R2 미러(async).
  await persistCompanyArchiveRename(
    spreadsheetId,
    companyContractRef(oldKey.계약일, oldKey.업체명),
    {
      rowKey: companyContractRef(next.계약일, next.업체명),
      payload: { _cleared: false, 업체명: next.업체명.trim(), 계약일: next.계약일 },
    },
    opts,
  );
  return { moved: true };
}
