/**
 * Layer: repo — 아레나 재참가 이월 I/O (arena-carryover §2, 읽기=이전 기수 시트 / 쓰기=아레나).
 *
 * 04: 이전 시트의 상태=예약 미팅 raw(A~AN + 업체정보 확장 AQ~AS·AU~CD)를 아레나 04에 복사
 *     — 새 id 발급, AO="이월"/AP=원본 미팅 id. N/O/Q/S(수식)·AT(gcal 맵)·기존 행 비접촉(split write).
 * 02: service 가 기존 contract-payment repo(appendFromContract+updateUserFields) 재사용.
 * 멱등: 아레나 04 AP / 02 AJ 컬럼의 원본키 집합으로 중복 삽입 방지.
 * 이전 기수 시트는 읽기 전용 — 이 파일은 old 시트에 어떤 쓰기도 하지 않는다.
 *
 * R3-2: DB payload = **열문자 평탄화**(carriedMeetingPayload) — 구 `{id,_carryRaw,…}` 형태는
 * meetingFromDbPayload 가 복원 못 해 이월 미팅이 DB 읽기에서 통째로 소실되던 결함 수정.
 * 열문자 형태는 backfill 파서(read-daily)가 코드 추가 없이 Meeting 으로 복원한다.
 */
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { SHEET_RANGES } from "@/config";
import { mirrorSheetRow } from "./db/mirror";
import { findRowById } from "./meetings";
// 좌표 상수는 순수 코덱에서 직접 — 모듈 로드 시점에 쓰므로 meetings(I/O) 목킹과 무관해야 한다.
import {
  COMPANY_EXT_START,
  COMPANY_EXT2_START,
  COMPANY_FIELDS_EXT,
  COMPANY_FIELDS_EXT2,
  MEETING_READ_WIDTHS,
  MEETING_ROW_WIDTH,
} from "./meetings-rows";
import { isGridLimitsError } from "./grid-limits";
import { colName } from "@/util/sheet-column";
import { normalizeRrnFront } from "@/util/rrn-front";

const TAB = SHEET_RANGES.meetings.tab;
const ref = `'${TAB}'`;

export interface CarrySourceMeeting {
  원본id: string;
  raw: unknown[]; // A~AN (0..39) + 확장 AQ~AS(42..44)·AU~CD(46..81) — 없으면 빈칸
}

/** 업체정보 확장 열 인덱스 — AQ~AS + AU~CD(확장2·3·4). AO/AP(이월 깃발)·AT(gcal 맵)는 이월 대상 아님. */
const EXT_INDICES: number[] = [
  ...Array.from({ length: COMPANY_FIELDS_EXT.length }, (_, i) => COMPANY_EXT_START + i),
  ...Array.from({ length: MEETING_ROW_WIDTH - COMPANY_EXT2_START }, (_, i) => COMPANY_EXT2_START + i),
];
const EXT_FIRST = colName(COMPANY_EXT_START); // AQ
const EXT_LAST = colName(MEETING_ROW_WIDTH - 1); // CD
/** 확장 읽기 끝 열 후보(넓은 것부터) — CD → CC → BN → AS. 안 넓혀진 이전 시트는 한 단계씩 좁혀 읽는다. */
const EXT_READ_LASTS = MEETING_READ_WIDTHS.map((w) => colName(w - 1));
/** 주민등록번호 앞자리 열(BA) — 이월 쓰기 전 앞 6자리만 남긴다(belie 결정, 다른 저장 경로와 동일). */
const RRN_IDX = COMPANY_EXT2_START + COMPANY_FIELDS_EXT2.indexOf("주민등록번호");

/**
 * 이월 raw 저장 직전 정규화 — 순수. 주민등록번호(BA)는 앞 6자리 "NNNNNN-" 만(뒷자리 저장 불가).
 * 이전 시트는 학생이 직접 고칠 수 있어 BA 에 전체 번호가 있을 수 있다 — DB payload·아레나 시트
 * 어느 쪽에도 뒷자리가 넘어가지 않게 두 쓰기 경로가 이 함수를 공유한다.
 */
export function sanitizeCarryRaw(raw: readonly unknown[]): unknown[] {
  const out = [...raw];
  if (RRN_IDX < out.length && String(out[RRN_IDX] ?? "").trim() !== "") {
    out[RRN_IDX] = normalizeRrnFront(out[RRN_IDX]);
  }
  return out;
}

/** 확장 열 시트 쓰기값 — 비지 않은 문자열은 선행 apostrophe(plain text 강제, meetingToRow 규약). */
function extCell(v: unknown): string | number | boolean {
  if (typeof v === "string") return v.trim() === "" ? "" : `'${v}`;
  return (v ?? "") as string | number | boolean;
}

/** 이전 시트 04 에서 상태=예약 행 raw 추출 (J=9 가 "예약"). */
export async function listCarrySourceMeetings(
  oldSheetId: string,
): Promise<CarrySourceMeeting[]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: oldSheetId,
    range: `${ref}!A2:AN`,
    // 형제 04 리더(findById·findByDateRange·findByPreviousMeetingId)와 통일 — 날짜·시각 셀을
    // 시리얼로 읽는다. 기본 FORMATTED_VALUE 면 ko_KR 로케일에서 시각이 "오전 10:00" 표시문자열로
    // 나와 DB 정본(R3-2) 읽기의 serialToHHMM 파싱 실패→이월 행 소실(적대리뷰 HIGH). raw payload 로
    // DB 에 적재되므로 여기서 시리얼 정규화가 필수.
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  // 업체정보 확장(AQ~CD)은 별도 읽기 — 이전 기수 시트는 읽기 전용이라 grid 를 넓히지 않는다.
  // CD 까지 안 넓혀진 시트는 범위 초과 400 → AQ~CC(확장3까지) → AQ~BN(확장2까지) → AQ~AS(확장1까지) 순으로 좁혀
  // 있는 확장 칸은 살린다. 전부 실패(AQ 이전에서 끝나는 시트)면 확장값 없음으로 간주.
  const readExt = async (last: string) => {
    const ext = await sheetsClient().spreadsheets.values.get({
      spreadsheetId: oldSheetId,
      range: `${ref}!${EXT_FIRST}2:${last}`,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    });
    return (ext.data.values ?? []) as unknown[][];
  };
  let extRows: unknown[][] = [];
  for (const last of EXT_READ_LASTS) {
    try {
      extRows = await readExt(last);
      break;
    } catch (e) {
      if (!isGridLimitsError(e)) break; // 그 외 오류 = 확장값 없음(기존 규약)
    }
  }
  const out: CarrySourceMeeting[] = [];
  (res.data.values ?? []).forEach((r, rowIdx) => {
    const id = String(r[0] ?? "").trim();
    const 상태 = String(r[9] ?? "").trim();
    if (!id || 상태 !== "예약") return;
    out.push({ 원본id: id, raw: withExtColumns(r, extRows[rowIdx]) });
  });
  return out;
}

/** A~AN raw + (AQ 부터 읽은) 확장 행 → A~CD raw. 확장 행이 없으면 A~AN 그대로. 순수. */
export function withExtColumns(base: unknown[], ext: unknown[] | undefined): unknown[] {
  const raw = [...base];
  if (!ext) return raw;
  for (const idx of EXT_INDICES) {
    const v = ext[idx - COMPANY_EXT_START];
    if (v !== undefined) raw[idx] = v;
  }
  return raw;
}

/** 아레나 시트에 이미 이월된 원본키 집합 — 04 AP 컬럼. */
export async function listCarriedMeetingKeys(
  arenaSheetId: string,
): Promise<Set<string>> {
  // AP read 도 grid(37열) 밖이면 'exceeds grid limits' — 읽기 전 45열 보장
  // (rejoin 카나리아 실증 2026-06-11: 쓰기 ensure 만으론 부족).
  await ensureGridColumns(arenaSheetId, SHEET_RANGES.meetings.tab, 45);
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: arenaSheetId,
    range: `${ref}!AP2:AP`,
  });
  return new Set(
    (res.data.values ?? []).map((r) => String(r[0] ?? "").trim()).filter(Boolean),
  );
}

/** A열 기준 첫 빈 행 (meetings.ts findFirstEmptyRow 동일 패턴). */
async function firstEmptyRow(spreadsheetId: string): Promise<number> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: `${ref}!A2:A`,
  });
  const ids = (res.data.values ?? []).map((r) => String(r[0] ?? "").trim());
  for (let i = 0; i < ids.length; i++) if (!ids[i]) return i + 2;
  return ids.length + 2;
}

// 이월 DB payload 에서 제외할 인덱스 — 수식(N/O/Q/S)은 옛 시트의 stale 계산값이고,
// R(previousMeetingId)은 옛 시트 내부 참조라 시트 쓰기(appendCarriedMeeting)도 비운다.
const CARRY_DROP = new Set([13, 14, 16, 17, 18]);

/**
 * 이월 미팅 DB payload(열문자 평탄화) — A=새id, AO="이월", AP=원본id. 빈값 skip.
 * src.raw 는 이미 "시트 읽기 결과" 형식이어야 한다(apostrophe 없음) — listCarrySourceMeetings
 * 는 원래 그렇고, meetingToRow 출신 raw(arena-carryover.ts DB 유니언)는 그 호출부에서
 * stripUserEnteredEscapes 로 미리 정규화해서 넘긴다(BBE-65). 이 함수는 소스를 구분하지
 * 않는다 — 구분하려다 시트 읽기(주류) 경로의 진짜 apostrophe 데이터를 훼손한 적대검증
 * 회귀(BBE-65 2차) 발견 후, 정규화를 소스 쪽으로 옮기고 여기는 원래 단순 복사로 되돌림.
 */
export function carriedMeetingPayload(
  src: CarrySourceMeeting,
  newId: string,
): Record<string, unknown> {
  const p: Record<string, unknown> = { A: newId };
  const raw = sanitizeCarryRaw(src.raw);
  for (const i of [...Array.from({ length: 39 }, (_, k) => k + 1), ...EXT_INDICES]) {
    if (CARRY_DROP.has(i)) continue;
    const v = raw[i];
    const s = String(v ?? "").trim();
    if (s !== "") p[colName(i)] = v as unknown;
  }
  p.AO = "이월";
  p.AP = src.원본id;
  return p;
}

/** 이월 행 split write — append/스냅샷 공용 (A:M / P / T~AN / AO:AP / AQ:AS / AU:CD, R·수식·AT 비접촉). */
async function writeCarriedRowAt(
  arenaSheetId: string,
  row: number,
  src: CarrySourceMeeting,
  newId: string,
): Promise<void> {
  const a2m = src.raw.slice(0, 13).map((v) => v ?? "");
  a2m[0] = newId; // 새 id (옛/새 시트 id 혼동 방지 — 원본은 AP 에)
  // T~AN(업체정보 20 + 커스텀 JSON)도 meetingToRow 처럼 문자열은 apostrophe — 백만원 매출 칸
  // (과년도매출 "1,234" · 금년도매출 "250.1", company-finance-won-grid)이 숫자로 바뀌지 않게.
  const t2an = Array.from({ length: 21 }, (_, i) => extCell(src.raw[19 + i]));
  // 확장 열: 주민등록번호 앞자리 정규화 + 문자열은 apostrophe(USER_ENTERED 가 "1988-01-24"·
  // "120%"·"1,000"·"250.1"·"2026"(매출기준연도) 을 날짜·숫자로 바꾸지 않게 — UNFORMATTED 읽기는
  // 원래 apostrophe 를 떼고 준다).
  const extRaw = sanitizeCarryRaw(src.raw);
  const aq2as = Array.from({ length: COMPANY_FIELDS_EXT.length }, (_, i) => extCell(extRaw[COMPANY_EXT_START + i]));
  const au2cd = Array.from(
    { length: MEETING_ROW_WIDTH - COMPANY_EXT2_START },
    (_, i) => extCell(extRaw[COMPANY_EXT2_START + i]),
  );
  // 확장값이 실린 raw 만 AQ:AS·AU:CD 를 쓴다 — 레거시 A~AN raw(_carryRaw 등)로 기존 행을
  // 갱신할 때 확장 칸을 빈값으로 덮지 않기 위함(§2.5 취지).
  const hasExt = src.raw.length > COMPANY_EXT_START;
  const extData = hasExt
    ? [
        { range: `${ref}!AQ${row}:AS${row}`, values: [aq2as] },
        { range: `${ref}!${colName(COMPANY_EXT2_START)}${row}:${EXT_LAST}${row}`, values: [au2cd] },
      ]
    : [];
  // AO:AP·AQ:CD 쓰기 — 04 grid 가 AN(40)까지인 시트에서 grid limit 에러 (field-grid 실측,
  // 잠복 버그: 라이브 이월 0건이라 미발현이었음) → CD(82열) 보장 후 쓰기.
  await ensureGridColumns(arenaSheetId, SHEET_RANGES.meetings.tab, MEETING_ROW_WIDTH);
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: arenaSheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${ref}!A${row}:M${row}`, values: [a2m as (string | number | boolean)[]] },
        { range: `${ref}!P${row}`, values: [[src.raw[15] ?? ""] as (string | number | boolean)[]] },
        { range: `${ref}!T${row}:AN${row}`, values: [t2an as (string | number | boolean)[]] },
        { range: `${ref}!AO${row}:AP${row}`, values: [["이월", src.원본id]] },
        ...extData,
      ],
    },
  });
}

/**
 * 이월 미팅 1행 append — split write(A:M / P / R빈값 / T~AN / AO:AP).
 * N/O/Q/S 수식 비접촉. R(previousMeetingId)은 옛 시트 내부 참조라 비움.
 */
export async function appendCarriedMeeting(
  arenaSheetId: string,
  src: CarrySourceMeeting,
  newId: string,
  opts: { mirror?: boolean } = {},
): Promise<void> {
  const row = await firstEmptyRow(arenaSheetId);
  await writeCarriedRowAt(arenaSheetId, row, src, newId);
  // P1 미러 — 열문자 평탄화(이월 플래그 AO/AP 포함). 키 = 새 id.
  // R3-2: DB 정본 경로는 mirror:false(시트만, DB 는 서비스가 동기 저장).
  if (opts.mirror !== false) {
    mirrorSheetRow({
      spreadsheetId: arenaSheetId,
      tab: "meetings",
      rowKey: newId,
      payload: carriedMeetingPayload(src, newId),
    });
  }
}

/** 수렴 동기화 잡용 — 이월 행을 update-or-append 로 시트에 반영(레거시 _carryRaw 포함). */
export async function upsertCarriedRawSnapshot(
  arenaSheetId: string,
  src: CarrySourceMeeting,
  newId: string,
): Promise<void> {
  const row = (await findRowById(arenaSheetId, newId)) ?? (await firstEmptyRow(arenaSheetId));
  await writeCarriedRowAt(arenaSheetId, row, src, newId);
}
