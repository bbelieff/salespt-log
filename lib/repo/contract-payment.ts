/**
 * Layer: repo — 02 계약수납관리 시트 I/O (v2: 30컬럼 A~AD).
 *
 * 1행 = 그룹 헤더, 2행 = 필드 헤더, 3행~ = 데이터.
 * 컬럼 매핑 (SSOT: docs/domains/sheet-structure.md §4 v2):
 *   A: 공란
 *   B: 순번 (자동 — read만, append 시 Sheet rows 인덱스 그대로)
 *   C 계약일 · D 업체명 · E 수임비 (자동 연동, 04 D/G/L) · AK 연결 미팅 id(개명 안전 키)
 *   F~L 체크박스 7개("ㅇ"/"") · M~R 수납1 · S~X 수납2 · Y~AD 수납3(각 진행기관/진행률/현황/승인금액/수납액/수납일)
 *   진행률 컬럼(N/T/Z): 시트 data validation = "0%/20%/40%/60%/80%/100%" 텍스트 dropdown
 *
 * 가드레일:
 *   • 1행·2행(헤더)은 절대 쓰지 않음 — append/update는 row≥3.
 *   • B(순번)는 시트 수식 또는 사용자가 직접 — 앱은 빈 문자열 send.
 */
import { SHEET_RANGES } from "@/config";
import { ContractPayment } from "@/types";
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { mirrorClearRow } from "./db/mirror";
import { clearContractRowInDbSync, type ContractWriteOpts, persistContractRow, userFieldsMirrorPayload } from "./db/contracts-clear";
import { queueContractRowSync } from "./contract-sheet-sync";
import { cpToRow, rowToCP, serialToISODate, toStr } from "./contract-payment-row";

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
export async function resolveLayout(
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

export function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

// ── Public API ─────────────────────────────────────────────────

/** 02 계약수납관리 모든 행 read (firstDataRow~). 7기·6기 양식 동시 지원. */
export async function readAll(spreadsheetId: string): Promise<ContractPayment[]> {
  const { tab, firstDataRow } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!A${firstDataRow}:AO`; // A~AH 실사용 + AI~AJ 이월 + AK 연결 미팅 id + AL~AO 해지
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
 * 특정 row 의 (계약일, 업체명) — cascade 삭제 전 key 읽기용 (2026-06 bugfix).
 *
 * service 계층이 직접 SHEET_RANGES.contractPayment.tab 을 쓰면
 * 6기 legacy `02 계약관리` 탭 alias 를 무시해 "Unable to parse range" 사고.
 * resolveLayout 을 거쳐 올바른 탭명을 쓰도록 repo 에 노출.
 */
export async function readContractCascadeKey(
  spreadsheetId: string,
  row: number,
): Promise<{ 계약일: string; 업체명: string }> {
  const { tab } = await resolveLayout(spreadsheetId);
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${tabRef(tab)}!C${row}:D${row}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const r = (res.data.values?.[0] ?? []) as unknown[];
  return {
    계약일: serialToISODate(r[0]),
    업체명: toStr(r[1]).trim(),
  };
}

/** AK(연결 미팅 id) 의 C 기준 offset — C=col2, AK=col36 → 34. */
const LINK_ID_OFFSET = 34;

/**
 * 02 row 매칭. **meetingId 우선**(개명·계약일변경에도 안전), 없으면 (계약일+업체명) 폴백(레거시).
 * 같은 키가 여러 row면 가장 빠른(작은 row 번호) 것 반환.
 */
export async function findRowByLink(
  spreadsheetId: string,
  key: { meetingId?: string; 계약일?: string; 업체명?: string },
): Promise<number | null> {
  const { tab, firstDataRow } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!C${firstDataRow}:AK`; // C..AK (AK = 연결 미팅 id)
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const values = (res.data.values ?? []) as unknown[][];
  // 1) id 우선
  if (key.meetingId) {
    for (let i = 0; i < values.length; i++) {
      if (toStr((values[i] ?? [])[LINK_ID_OFFSET]).trim() === key.meetingId) {
        return firstDataRow + i;
      }
    }
  }
  // 2) 레거시 폴백 (계약일+업체명)
  if (key.계약일 && key.업체명) {
    for (let i = 0; i < values.length; i++) {
      const r = values[i] ?? [];
      if (serialToISODate(r[0]) === key.계약일 && toStr(r[1]).trim() === key.업체명.trim()) {
        return firstDataRow + i;
      }
    }
  }
  return null;
}

/**
 * 계약 액션 시 자동 호출: 새 row append (C/D/E만 채움, F~AA는 빈 값).
 * 사용자는 계약수납탭에서 추가 입력.
 *
 * BBE-53 자연키 upsert: meetingId 가 있으면 findFirstEmptyRow 전에 findRowByLink 로
 * 기존 행을 먼저 찾는다. 있으면 그 행을 갱신(append 안 함) — 같은 미팅에서 저장을
 * 몇 번 재시도해도(응답 유실 등) 행은 하나.
 *
 * `dateCompanyFallback`(기본 false): meetingId 매칭이 없을 때 (계약일+업체명) 만으로도
 * 기존 행을 찾을지 여부. addFromContract(미팅에서 계약, meetingId 조회 실패 폴백)만 true 로
 * 넘긴다 — addPriorContract(직접 등록)는 이 검사를 타지 않는다. 이유: 직접 등록은 meetingId
 * 가 원천적으로 없어 (계약일+업체명) 단독 매칭이 **서로 무관한 실제 계약 행을 오매칭**할 위험이
 * 있다(같은 날 같은 업체의 정식 계약을 "이전 계약 직접등록"이 덮어씀). 그 경로의 멱등 판정은
 * 호출부(addPriorContract)가 (계약일+업체명+수임비 + 구분=이월) 로 더 좁게 별도 수행한다.
 */
export async function appendFromContract(
  spreadsheetId: string,
  data: { 계약일: string; 업체명: string; 수임비: number; meetingId?: string },
  carryover?: { 원본행id: string }, // 출발 미팅이 이월(04 AO)이면 깃발 상속 (§3)
  opts?: ContractWriteOpts, // 생략=R2 미러(no-throw). append 는 멱등키가 없어 기본 throw 금지(§6 R3-3)
  dateCompanyFallback = false,
): Promise<{ row: number }> {
  if (data.meetingId || dateCompanyFallback) {
    const existing = await findRowByLink(spreadsheetId, {
      meetingId: data.meetingId,
      ...(dateCompanyFallback ? { 계약일: data.계약일, 업체명: data.업체명 } : {}),
    });
    if (existing !== null) {
      await writeContractRow(spreadsheetId, existing, data, carryover, opts);
      return { row: existing };
    }
  }
  const row = await findFirstEmptyRow(spreadsheetId);
  await writeContractRow(spreadsheetId, row, data, carryover, opts);
  return { row };
}

/** C:E(+AK 링크·AI:AJ 이월) 를 지정 row 에 쓰고 DB 를 반영 — append(신규 row)·upsert(기존 row) 공용. */
async function writeContractRow(
  spreadsheetId: string,
  row: number,
  data: { 계약일: string; 업체명: string; 수임비: number; meetingId?: string },
  carryover: { 원본행id: string } | undefined,
  opts: ContractWriteOpts | undefined,
): Promise<void> {
  const { tab } = await resolveLayout(spreadsheetId);
  // AK(col 37) 쓰기 전 그리드 보장 — 기존 02 는 A:AJ(36열)뿐, AK 쓰면 batchUpdate 전체 거부(계약 깨짐).
  if (data.meetingId) await ensureGridColumns(spreadsheetId, tab, 37);
  const writes = [
    {
      range: `${tabRef(tab)}!C${row}:E${row}`,
      values: [[data.계약일, data.업체명, data.수임비] as (string | number)[]],
    },
  ];
  if (data.meetingId) {
    // AK = 연결 미팅 id. ' 접두어로 text 강제(숫자/날짜 coercion 방지, carryover 키와 동일 패턴).
    writes.push({
      range: `${tabRef(tab)}!AK${row}`,
      values: [[`'${data.meetingId}`]],
    });
  }
  if (carryover) {
    writes.push({
      range: `${tabRef(tab)}!AI${row}:AJ${row}`,
      // 원본키는 plain text 강제 — "02:10" 류가 USER_ENTERED 에서 시간값(2:10)으로
      // 변환돼 멱등 키가 깨지는 사고(rejoin 카나리아 2026-06-11 실증).
      values: [["이월", `'${carryover.원본행id}`]],
    });
  }
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: writes },
  });
  // DB 반영(_cleared 병합 되살림). 기본=R2 미러, opts.syncDb=동기 upsert(실패 throw). 구분='이월' 의 유일
  // DB writer 라 미러 1회 실패=시트와 갈림(#558 ② DevD) → AJ 멱등키 보유한 arena-carryover 만 승격.
  await persistContractRow(spreadsheetId, row, {
    _cleared: false, 계약일: data.계약일, 업체명: data.업체명, 수임비: data.수임비,
    ...(data.meetingId ? { meetingId: data.meetingId } : {}),
    ...(carryover ? { 구분: "이월", 원본행id: carryover.원본행id } : {}),
  }, opts);
}

/** 사용자 입력 영역(F~AD) update — 한 row 통째로.
 *
 * BBE-246: 파일럿(opts.syncDb) = **DB 동기 정본**(실패=throw) 먼저 쓰고, 시트는 큐잉된 비동기
 * 수렴 잡(contract-sheet-sync.ts)에 맡긴다 — 요청 경로에서 시트 API 호출 제거. 비파일럿은 R2
 * 그대로(시트 동기 정본 + DB 비동기 미러, 완전 불변·롤백 스위치). */
export async function updateUserFields(
  spreadsheetId: string,
  cp: ContractPayment,
  opts?: ContractWriteOpts,
): Promise<void> {
  const validated = ContractPayment.parse(cp);
  if (!validated.row) {
    throw new Error("[contract-payment] row 번호 필수 (≥3)");
  }
  const payload = userFieldsMirrorPayload(validated);
  if (opts?.syncDb) {
    await persistContractRow(spreadsheetId, validated.row, payload, opts);
    queueContractRowSync(spreadsheetId, validated.row);
    return;
  }
  const fullRow = cpToRow(validated);
  // F~AH = idx 5~33 (29 columns: 7 체크박스 + 18 슬롯 + AE 로드맵 + AF/AG/AH 슬롯메모).
  const userArea = fullRow.slice(5, 34);
  const { tab } = await resolveLayout(spreadsheetId);
  const range = `${tabRef(tab)}!F${validated.row}:AH${validated.row}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [userArea] },
  });
  // R2 — F:AH 편집만 미러(이월 flag 구분·이월원본행id 제외 = arena-carryover 클로버 방지, #541).
  await persistContractRow(spreadsheetId, validated.row, payload, opts);
}

/** row 식별로 한 row clear (C~AO — A 공란/B 순번 수식 보존).
 *
 *  버그 fix: 이전에는 A~AD 전체 clear → 사용자 시트의 B(순번) 수식까지
 *  지워버려 row 번호가 사라지는 문제 있었음. ARRAY 수식·순번 자동계산 보존.
 *
 * BBE-246: 파일럿(opts.syncDb) = **DB 동기 정본 삭제**(실패=throw, 조용한 반쪽 삭제 금지,
 * Dev3-A 작업1) 먼저, 시트 clear 는 큐잉된 비동기 수렴 잡에 맡긴다(_cleared 페이로드를
 * 보고 실제 clear 를 수행 — contract-sheet-sync.ts). 비파일럿은 R2 그대로.
 */
export async function clearRow(
  spreadsheetId: string,
  row: number,
  opts?: { syncDb?: boolean },
): Promise<void> {
  const { tab, firstDataRow } = await resolveLayout(spreadsheetId);
  if (row < firstDataRow) {
    throw new Error(`[contract-payment] 헤더 행 보호: row ${row} clear 거부`);
  }
  if (opts?.syncDb) {
    await clearContractRowInDbSync(spreadsheetId, row);
    queueContractRowSync(spreadsheetId, row);
    return;
  }
  const range = `${tabRef(tab)}!C${row}:AO${row}`; // 이월(AI~AJ)·연결 id(AK)·해지(AL~AO)도 함께 clear
  await sheetsClient().spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
  mirrorClearRow({ spreadsheetId, tab: "contracts", rowKey: `r${row}` }); // R2 — 비파일럿 fire-and-forget
}
export { syncFeeFromContract } from "./contract-payment-sync";
// 링크키(계약일·업체명) 기반 쓰기 — 500줄 캡으로 분리(R3-3 잔여). 공개 API 경로는 유지.
export { clearRowByLink, updateLinkFields } from "./contract-payment-link";
// 행 ↔ ContractPayment 순수 변환 — 500줄 캡으로 분리(BBE-246). read-daily.ts 등 기존 소비처의
// import 경로("@/repo/contract-payment")를 그대로 유지하기 위한 재수출(R3-3 선례와 동일).
export { rowToCP } from "./contract-payment-row";
