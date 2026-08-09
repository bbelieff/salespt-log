/**
 * Layer: repo — 아레나 재참가 이월 I/O (arena-carryover §2, 읽기=이전 기수 시트 / 쓰기=아레나).
 *
 * 04: 이전 시트의 상태=예약 미팅 raw(A~AN)를 아레나 04에 복사 — 새 id 발급,
 *     AO="이월"/AP=원본 미팅 id. N/O/Q/S(수식)·기존 행 비접촉(split write).
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
import { APOSTROPHE_ESCAPED_COL_INDICES, stripSheetTextEscape } from "./meetings-rows";

const TAB = SHEET_RANGES.meetings.tab;
const ref = `'${TAB}'`;

export interface CarrySourceMeeting {
  원본id: string;
  raw: unknown[]; // A~AN (0..39)
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
  const out: CarrySourceMeeting[] = [];
  for (const r of res.data.values ?? []) {
    const id = String(r[0] ?? "").trim();
    const 상태 = String(r[9] ?? "").trim();
    if (id && 상태 === "예약") out.push({ 원본id: id, raw: r });
  }
  return out;
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

/** 열 인덱스 → 열문자 (backfill rowObj 규칙과 동일, ~AP=41 충분). */
function colName(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26);
}

// 이월 DB payload 에서 제외할 인덱스 — 수식(N/O/Q/S)은 옛 시트의 stale 계산값이고,
// R(previousMeetingId)은 옛 시트 내부 참조라 시트 쓰기(appendCarriedMeeting)도 비운다.
const CARRY_DROP = new Set([13, 14, 16, 17, 18]);

/**
 * 이월 미팅 DB payload(열문자 평탄화) — A=새id, AO="이월", AP=원본id. 빈값 skip.
 * src.raw 는 두 소스 혼용(시트 읽기 apostrophe 없음 vs meetingToRow 출력 apostrophe 있음,
 * BBE-65) — jsonb 목적지는 시트의 USER_ENTERED 파싱을 거치지 않으므로 여기서 벗겨
 * 형식을 시트 읽기 결과와 통일한다(meetingFromDbPayload/rowToMeeting 은 apostrophe 없는
 * 값을 기대).
 */
export function carriedMeetingPayload(
  src: CarrySourceMeeting,
  newId: string,
): Record<string, unknown> {
  const p: Record<string, unknown> = { A: newId };
  for (let i = 1; i <= 39; i++) {
    if (CARRY_DROP.has(i)) continue;
    const raw = src.raw[i];
    const v = APOSTROPHE_ESCAPED_COL_INDICES.has(i) ? stripSheetTextEscape(raw) : raw;
    const s = String(v ?? "").trim();
    if (s !== "") p[colName(i)] = v as unknown;
  }
  p.AO = "이월";
  p.AP = src.원본id;
  return p;
}

/** 이월 행 split write — append/스냅샷 공용 (A:M / P / T~AN / AO:AP, R·수식 비접촉). */
async function writeCarriedRowAt(
  arenaSheetId: string,
  row: number,
  src: CarrySourceMeeting,
  newId: string,
): Promise<void> {
  const a2m = src.raw.slice(0, 13).map((v) => v ?? "");
  a2m[0] = newId; // 새 id (옛/새 시트 id 혼동 방지 — 원본은 AP 에)
  const t2an = Array.from({ length: 21 }, (_, i) => src.raw[19 + i] ?? "");
  // AO:AP 쓰기 — 04 grid 가 AN(40)까지인 시트에서 grid limit 에러 (field-grid 실측,
  // 잠복 버그: 라이브 이월 0건이라 미발현이었음) → 45열 보장 후 쓰기.
  await ensureGridColumns(arenaSheetId, SHEET_RANGES.meetings.tab, 45);
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: arenaSheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${ref}!A${row}:M${row}`, values: [a2m as (string | number | boolean)[]] },
        { range: `${ref}!P${row}`, values: [[src.raw[15] ?? ""] as (string | number | boolean)[]] },
        { range: `${ref}!T${row}:AN${row}`, values: [t2an as (string | number | boolean)[]] },
        { range: `${ref}!AO${row}:AP${row}`, values: [["이월", src.원본id]] },
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
