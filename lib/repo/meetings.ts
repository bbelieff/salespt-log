/**
 * Layer: repo — 04 업체관리(앱자동작성용) 탭 I/O.
 * 1행 = 1미팅. 19컬럼 A~S (+업체정보 T~AN·AQ~AS, 이월깃발 AO/AP).
 *
 * 가드레일:
 *   • N/O/Q/S는 시트 수식 자동 — 쓰기 안 함 (split write 가 비접촉)
 *   • UUID 고유성: id로 행 식별
 *
 * 행 코덱(Meeting↔행 배열·컬럼 좌표)은 meetings-rows.ts — 여기서 재수출(임포터 불변).
 * SSOT: docs/domains/sheet-structure.md §3
 */
import { SHEET_RANGES } from "@/config";
import { Meeting } from "@/types";
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { mirrorSheetRow, mirrorClearRow } from "./db/mirror";
import {
  COL,
  COMPANY_CUSTOM_COL,
  COMPANY_EXT_START,
  COMPANY_FIELD_START,
  meetingToRow,
  rowToMeeting,
  serialToISODate,
} from "./meetings-rows";

// 무동작 추출(R3-2) 재수출 — 기존 임포터(read-daily 등) 경로 보존.
export {
  COMPANY_FIELDS,
  COMPANY_FIELDS_EXT,
  COMPANY_FIELD_START,
  COMPANY_CUSTOM_COL,
  COMPANY_EXT_START,
  rowToMeeting,
} from "./meetings-rows";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

const TAB = SHEET_RANGES.meetings.tab;
const RANGE_ALL = `${tabRef(TAB)}!${SHEET_RANGES.meetings.range}`; // A2:S
const ID_COL_RANGE = `${tabRef(TAB)}!A2:A`; // id 검색용

// ── Public API ─────────────────────────────────────────────────

/**
 * 헤더 다음 첫 빈 행(1-based) — values.append 는 데이터검증 phantom 행(K열 FALSE)
 * 너머에 붙기 때문에 A열(id) 기준으로 직접 탐색.
 */
async function findFirstEmptyRow(spreadsheetId: string): Promise<number> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: ID_COL_RANGE,
  });
  const ids = (res.data.values ?? []).map((r) => String(r[0] ?? "").trim());
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) return i + 2; // 데이터 시작은 행 2
  }
  return ids.length + 2; // 모두 차있으면 끝에 추가
}

/** 미팅 1건 append — A열 빈 행에 split write (N/O/Q/S 수식 보존, id 중복 검증은 호출 측). */
export async function appendMeeting(
  spreadsheetId: string,
  meeting: Meeting,
  opts: { mirror?: boolean } = {},
): Promise<void> {
  const validated = Meeting.parse(meeting);
  const row = meetingToRow(validated);
  const targetRow = await findFirstEmptyRow(spreadsheetId);
  await writeMeetingRowSplit(spreadsheetId, targetRow, row);
  // R3-2: DB 정본 경로는 mirror:false(시트만, DB 는 서비스가 동기 저장).
  if (opts.mirror !== false) mirrorSheetRow({ spreadsheetId, tab: "meetings", rowKey: validated.id, payload: validated }); // P1
}

/** R3-2 수렴 동기화 잡용 — 최신 DB 상태(full Meeting)를 update-or-append 로 시트에 반영.
 * updateMeeting(병합식) 재사용 금지: DB 에서 지워진 optional 키를 시트 잔존값이 되살린다.
 * 이월 행(m.구분)이면 AO:AP 깃발도 함께 기록. 미러 없음(정본은 이미 DB). */
export async function upsertMeetingRowSnapshot(
  spreadsheetId: string,
  meeting: Meeting,
): Promise<void> {
  const m = Meeting.parse(meeting);
  const row =
    (await findRowById(spreadsheetId, m.id)) ??
    (await findFirstEmptyRow(spreadsheetId));
  await writeMeetingRowSplit(spreadsheetId, row, meetingToRow(m));
  if (m.구분) {
    await sheetsClient().spreadsheets.values.update({
      spreadsheetId,
      range: `${tabRef(TAB)}!AO${row}:AP${row}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[m.구분, m.이월원본행id ?? ""]] },
    });
  }
}

/** Meeting row split write — 수식(N/O/Q/S)·이월(AO/AP) 보존. append/update 공용. */
async function writeMeetingRowSplit(
  spreadsheetId: string,
  sheetRow: number,
  fullRow: (string | number | boolean)[],
): Promise<void> {
  await ensureGridColumns(spreadsheetId, TAB, 45); // AS 까지 — grid limit 가드
  const A_to_M = fullRow.slice(0, 13); // A=0 ~ M=12 (사용자 입력)
  const P_only = [fullRow[COL.계약조건]]; // P=15
  const R_only = [fullRow[COL.previousMeetingId]]; // R=17
  // 업체정보 T~AN (T=19~AN=39) + 확장 AQ~AS (42~44). 미팅(A:M/P/R)·수식(N/O/Q/S)·
  // 이월깃발(AO/AP)과 전부 분리 — 서로 보존.
  const T_to_AN = fullRow.slice(COMPANY_FIELD_START, COMPANY_CUSTOM_COL + 1);
  const AQ_to_AS = fullRow.slice(COMPANY_EXT_START, COMPANY_EXT_START + 3);
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${tabRef(TAB)}!A${sheetRow}:M${sheetRow}`,
          values: [A_to_M],
        },
        {
          range: `${tabRef(TAB)}!P${sheetRow}`,
          values: [P_only as (string | number | boolean)[]],
        },
        {
          range: `${tabRef(TAB)}!R${sheetRow}`,
          values: [R_only as (string | number | boolean)[]],
        },
        {
          range: `${tabRef(TAB)}!T${sheetRow}:AN${sheetRow}`,
          values: [T_to_AN],
        },
        {
          range: `${tabRef(TAB)}!AQ${sheetRow}:AS${sheetRow}`,
          values: [AQ_to_AS],
        },
      ],
    },
  });
}

/** id → 행 번호 (1-based, 없으면 null). 데이터는 2행부터. */
export async function findRowById(
  spreadsheetId: string,
  id: string,
): Promise<number | null> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: ID_COL_RANGE,
  });
  const ids = (res.data.values ?? []).map((r) => String(r[0] ?? ""));
  const idx = ids.indexOf(id);
  if (idx < 0) return null;
  return idx + 2; // 헤더가 1행이므로 +2
}

/** id로 미팅 조회. */
export async function findById(
  spreadsheetId: string,
  id: string,
): Promise<Meeting | null> {
  const sheetRow = await findRowById(spreadsheetId, id);
  if (sheetRow === null) return null;
  // A:AS — 업체정보(T~AN·AQ~AS)·이월(AO/AP) 포함. (구 A:S — 업체정보 누락으로
  // 계약 06 스냅샷 경로(re-findById)가 빈 업체정보를 받던 잠복 결함, field-grid fix)
  const range = `${tabRef(TAB)}!A${sheetRow}:AS${sheetRow}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const r = res.data.values?.[0];
  if (!r) return null;
  return rowToMeeting(r as unknown[]);
}

/** 특정 행 부분 update — 수식(N/O/Q/S) 자동 제외. */
export async function updateMeeting(
  spreadsheetId: string,
  id: string,
  partial: Partial<Omit<Meeting, "id">>,
  opts: { mirror?: boolean } = {},
): Promise<void> {
  const sheetRow = await findRowById(spreadsheetId, id);
  if (sheetRow === null) {
    throw new Error(`[meetings.ts] id를 찾을 수 없음: ${id}`);
  }
  const current = await findById(spreadsheetId, id);
  if (!current) {
    throw new Error(`[meetings.ts] id로 행은 찾았으나 파싱 실패: ${id}`);
  }
  const merged: Meeting = Meeting.parse({ ...current, ...partial });
  const fullRow = meetingToRow(merged);

  // 수식 컬럼(N/O/Q/S) 보존을 위해 split write — appendMeeting과 동일 헬퍼 재사용.
  await writeMeetingRowSplit(spreadsheetId, sheetRow, fullRow);
  // R3-2: DB 정본 경로는 mirror:false(시트만, DB 는 서비스가 동기 저장).
  if (opts.mirror !== false) mirrorSheetRow({ spreadsheetId, tab: "meetings", rowKey: id, payload: merged }); // P1
}

/** 날짜로 미팅 조회. type='reservation'이면 예약일(B), 'meeting'이면 미팅날짜(D) 기준. */
export async function findByDate(
  spreadsheetId: string,
  date: string,
  type: "reservation" | "meeting" = "meeting",
): Promise<Meeting[]> {
  const map = await findByDateRange(spreadsheetId, [date], type);
  return map.get(date) ?? [];
}

/** 여러 날짜 1-read 조회 (주간 뷰 quota 절약). 반환: date→Meeting[] map. */
export async function findByDateRange(
  spreadsheetId: string,
  dates: string[],
  type: "reservation" | "meeting" = "meeting",
): Promise<Map<string, Meeting[]>> {
  const wanted = new Set(dates);
  const result = new Map<string, Meeting[]>();
  for (const d of dates) result.set(d, []);

  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE_ALL,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const all = (res.data.values ?? []) as unknown[][];
  const targetCol = type === "reservation" ? COL.예약일 : COL.미팅날짜;
  // dedupe: 같은 id 첫 번째만
  const seenIds = new Set<string>();
  for (const r of all) {
    const rowDate = serialToISODate(r[targetCol]);
    if (!wanted.has(rowDate)) continue;
    const parsed = rowToMeeting(r);
    if (!parsed) continue;
    if (seenIds.has(parsed.id)) continue;
    seenIds.add(parsed.id);
    result.get(rowDate)!.push(parsed);
  }
  return result;
}

/** 전체 미팅 1-read — 발굴 후보 matched 파생용(콜·지·기·소 미팅의 발굴id·업체명 집합, lead-chain §7-1).
 * id 중복은 첫 행만. 시트는 발굴id 컬럼이 없으므로 비파일럿 미팅은 발굴id 미보유(업체명 폴백으로 매칭). */
export async function readAllMeetings(spreadsheetId: string): Promise<Meeting[]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE_ALL,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const all = (res.data.values ?? []) as unknown[][];
  const out: Meeting[] = [];
  const seen = new Set<string>();
  for (const r of all) {
    const m = rowToMeeting(r);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/**
 * 1-read 로 두 기준(예약일/미팅날짜) 동시 추출 — 컨택 badge(예약일)·일정 카드
 * (미팅날짜)가 같은 데이터의 다른 필터. 사용처: loadWeekMeetings.
 */
export async function findByDateRangeBoth(
  spreadsheetId: string,
  dates: string[],
): Promise<{
  byMeetingDate: Map<string, Meeting[]>;
  byReservationDate: Map<string, Meeting[]>;
}> {
  const wanted = new Set(dates);
  const byMeetingDate = new Map<string, Meeting[]>();
  const byReservationDate = new Map<string, Meeting[]>();
  for (const d of dates) {
    byMeetingDate.set(d, []);
    byReservationDate.set(d, []);
  }

  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE_ALL,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const all = (res.data.values ?? []) as unknown[][];
  const seenIds = new Set<string>();
  for (const r of all) {
    const parsed = rowToMeeting(r);
    if (!parsed) continue;
    if (seenIds.has(parsed.id)) continue;
    seenIds.add(parsed.id);
    const meetingDate = serialToISODate(r[COL.미팅날짜]);
    const reservationDate = serialToISODate(r[COL.예약일]);
    if (wanted.has(meetingDate))
      byMeetingDate.get(meetingDate)!.push(parsed);
    if (wanted.has(reservationDate))
      byReservationDate.get(reservationDate)!.push(parsed);
  }
  return { byMeetingDate, byReservationDate };
}

/** previousMeetingId==originalId 미팅 탐색 — 일정 변경 되돌리기 cascade 용. */
export async function findByPreviousMeetingId(
  spreadsheetId: string,
  originalId: string,
): Promise<Meeting | null> {
  const range = `${tabRef(TAB)}!A2:S`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const rows = (res.data.values ?? []) as unknown[][];
  for (const r of rows) {
    const prev = String(r[COL.previousMeetingId] ?? "");
    if (prev === originalId) {
      try {
        return rowToMeeting(r);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** id로 행 클리어 (실제 삭제 아니라 빈 값으로 update). */
export async function clearMeeting(
  spreadsheetId: string,
  id: string,
  opts: { mirror?: boolean } = {},
): Promise<void> {
  const sheetRow = await findRowById(spreadsheetId, id);
  if (sheetRow === null) return;
  await ensureGridColumns(spreadsheetId, TAB, 45); // AQ~AS 클리어 — grid limit 가드
  // A~M, P, R 비우기 (수식 컬럼 N/O/Q/S는 건드리지 않음)
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${tabRef(TAB)}!A${sheetRow}:M${sheetRow}`,
          values: [Array(13).fill("")],
        },
        {
          range: `${tabRef(TAB)}!P${sheetRow}`,
          values: [[""]],
        },
        {
          range: `${tabRef(TAB)}!R${sheetRow}`,
          values: [[""]],
        },
        {
          range: `${tabRef(TAB)}!T${sheetRow}:AN${sheetRow}`,
          values: [Array(21).fill("")], // 업체정보(T~AN)도 함께 비움
        },
        {
          range: `${tabRef(TAB)}!AQ${sheetRow}:AS${sheetRow}`,
          values: [Array(3).fill("")], // 확장 3필드 — AO/AP(이월)는 비접촉
        },
      ],
    },
  });
  // R3-2: DB 정본 경로는 mirror:false(시트만, DB 는 서비스가 동기 clear).
  if (opts.mirror !== false) mirrorClearRow({ spreadsheetId, tab: "meetings", rowKey: id }); // P1
}
