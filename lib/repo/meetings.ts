/**
 * Layer: repo — 04 업체관리(앱자동작성용) 탭 I/O.
 * 1행 = 1미팅. 19컬럼 A~S.
 *
 * 가드레일:
 *   • N/O/Q/S는 시트 수식 자동 — 쓰기 안 함 (append/update에서 빈 문자열 또는 미포함)
 *   • UUID 고유성: id로 행 식별
 *
 * SSOT: docs/domains/sheet-structure.md §3
 */
import { SHEET_RANGES } from "@/config";
import { Meeting, MeetingState } from "@/types";
import { ensureGridColumns, sheetsClient } from "./sheets-client";
import { mirrorSheetRow, mirrorClearRow } from "./db/mirror";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

// ── 시트 직렬값 ↔ ISO 변환 — USER_ENTERED 자동 변환분을 SERIAL_NUMBER 로 받아 ISO 복원.

function serialToISODate(v: unknown): string {
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // 이미 ISO
    const d = new Date(v); // "M/D/YYYY" 등 변종
    if (!Number.isNaN(d.getTime())) return toISO(d);
    return "";
  }
  if (typeof v === "number") {
    // Sheets serial: days since 1899-12-30
    const ms = (v - 25569) * 86_400_000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    return toISO(d);
  }
  return "";
}

function serialToHHMM(v: unknown): string {
  if (typeof v === "string") {
    if (/^\d{2}:\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{2}):(\d{2})/); // "10:00:00" → "10:00"
    if (m) return `${m[1]}:${m[2]}`;
    return "";
  }
  if (typeof v === "number") {
    const fraction = ((v % 1) + 1) % 1; // 하루 중 비율(음수 안전, 날짜+시간 결합 허용)
    const totalMinutes = Math.round(fraction * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return "";
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

const TAB = SHEET_RANGES.meetings.tab;
const RANGE_ALL = `${tabRef(TAB)}!${SHEET_RANGES.meetings.range}`; // A2:S
const ID_COL_RANGE = `${tabRef(TAB)}!A2:A`; // id 검색용

// 컬럼 인덱스 (0-based, A=0)
const COL = {
  id: 0,
  예약일: 1,
  예약시각: 2,
  미팅날짜: 3,
  미팅시간: 4,
  channel: 5,
  업체명: 6,
  장소: 7,
  예약비고: 8,
  상태: 9,
  계약여부: 10,
  수임비: 11,
  미팅사유: 12,
  표시상세: 13, // 수식 — 쓰기 안 함
  표시요약: 14, // 수식 — 쓰기 안 함
  계약조건: 15,
  계약합성라인: 16, // 수식 — 쓰기 안 함
  previousMeetingId: 17,
  주차: 18, // 수식 — 쓰기 안 함
} as const;

const FORMULA_COL_INDICES = new Set([
  COL.표시상세,
  COL.표시요약,
  COL.계약합성라인,
  COL.주차,
]);

// 업체정보 컬럼 순서 (T=19 ~ AM=38, 20필드) + 커스텀 JSON(AN=39). lib/types CompanyInfo 키와 일치.
export const COMPANY_FIELDS = [
  "개업일", "사업자구분", "사업자등록번호", "소재지", "소유여부",
  "업종주생산품목", "과년도매출", "금년도매출", "기대출사업자", "사대보험직원",
  "특허및인증", "업체기타메모",
  "대표자이름", "연락처통신사", "신용점수", "기대출개인", "자택주소지",
  "대표소유여부", "동종업계경력", "대표기타메모",
] as const;
export const COMPANY_FIELD_START = 19; // T
export const COMPANY_CUSTOM_COL = 39; // AN

// 확장 3필드 (AQ=42~AS=44 — AO~AP 이월깃발 뒤 append, field-grid 2026-06-11).
// 기존 과년도매출(Z)=표시 "Y-1" 키 유지 — 라이브 데이터 보존(컬럼 이동 금지).
export const COMPANY_FIELDS_EXT = [
  "대표자생년월일", "과년도매출Y2", "과년도매출Y3",
] as const;
export const COMPANY_EXT_START = 42; // AQ

/** 행 배열 T~AN(+AQ~AS) → CompanyInfo (모든 필드 빈값이고 커스텀 없으면 undefined). */
function buildCompanyInfo(r: unknown[]): Record<string, unknown> | undefined {
  const ci: Record<string, unknown> = {};
  let any = false;
  COMPANY_FIELDS.forEach((f, i) => {
    const v = String(r[COMPANY_FIELD_START + i] ?? "").trim();
    ci[f] = v;
    if (v) any = true;
  });
  COMPANY_FIELDS_EXT.forEach((f, i) => {
    const v = String(r[COMPANY_EXT_START + i] ?? "").trim();
    ci[f] = v;
    if (v) any = true;
  });
  const rawCustom = String(r[COMPANY_CUSTOM_COL] ?? "").trim();
  if (rawCustom) {
    try {
      ci.커스텀 = JSON.parse(rawCustom);
      any = true;
    } catch {
      /* 손상된 JSON 무시 */
    }
  }
  return any ? ci : undefined;
}

/** Meeting → 시트 1행 배열 (A~AS, 45셀). 수식·이월(AO/AP)·미설정은 빈 문자열. */
function meetingToRow(m: Meeting): (string | number | boolean)[] {
  const row: (string | number | boolean)[] = new Array(45).fill("");
  row[COL.id] = m.id;
  row[COL.예약일] = m.예약일;
  row[COL.예약시각] = m.예약시각;
  row[COL.미팅날짜] = m.미팅날짜;
  row[COL.미팅시간] = m.미팅시간;
  row[COL.channel] = m.channel;
  row[COL.업체명] = m.업체명;
  row[COL.장소] = m.장소;
  // 예약비고도 자유 텍스트 — plain text 강제.
  row[COL.예약비고] = m.예약비고 ? `'${m.예약비고}` : "";
  row[COL.상태] = m.상태;
  row[COL.계약여부] = m.계약여부;
  row[COL.수임비] = m.수임비;
  // 미팅사유도 자유 텍스트 — 동일하게 plain text 강제 (apostrophe prefix).
  row[COL.미팅사유] = m.미팅사유 ? `'${m.미팅사유}` : "";
  // 계약조건 자유 텍스트 — apostrophe prefix 로 plain text 강제("5%"→0.05 오변환 방지).
  row[COL.계약조건] = m.계약조건 ? `'${m.계약조건}` : "";
  row[COL.previousMeetingId] = m.previousMeetingId ?? "";
  // 업체정보 T~AN — 자유 텍스트는 apostrophe prefix(USER_ENTERED 오변환 방지). 빈값은 빈 셀.
  const ci = m.업체정보 as Record<string, unknown> | undefined;
  COMPANY_FIELDS.forEach((f, i) => {
    const v = ci ? String(ci[f] ?? "").trim() : "";
    row[COMPANY_FIELD_START + i] = v ? `'${v}` : "";
  });
  const customJson = m.업체정보?.커스텀
    ? JSON.stringify(m.업체정보.커스텀)
    : "";
  row[COMPANY_CUSTOM_COL] =
    customJson && customJson !== "{}" ? `'${customJson}` : "";
  // 확장 3필드 AQ~AS (AO/AP 이월깃발은 항상 빈 문자열 — split write 가 비접촉)
  COMPANY_FIELDS_EXT.forEach((f, i) => {
    const v = ci ? String(ci[f] ?? "").trim() : "";
    row[COMPANY_EXT_START + i] = v ? `'${v}` : "";
  });
  // 표시상세/표시요약/계약합성라인/주차는 시트 수식이 채움 → 빈 문자열 유지
  return row;
}

/** 시트 1행 배열 → Meeting (parse 실패 시 null). */
function rowToMeeting(r: unknown[]): Meeting | null {
  const idStr = String(r[COL.id] ?? "");
  if (!idStr) return null;

  const parsed = Meeting.safeParse({
    id: idStr,
    예약일: serialToISODate(r[COL.예약일]),
    예약시각: serialToHHMM(r[COL.예약시각]),
    미팅날짜: serialToISODate(r[COL.미팅날짜]),
    미팅시간: serialToHHMM(r[COL.미팅시간]),
    channel: String(r[COL.channel] ?? ""),
    업체명: String(r[COL.업체명] ?? ""),
    장소: String(r[COL.장소] ?? ""),
    예약비고: String(r[COL.예약비고] ?? ""),
    상태: (r[COL.상태] ?? "예약") as MeetingState,
    계약여부: r[COL.계약여부] === true || r[COL.계약여부] === "TRUE",
    수임비: Number(r[COL.수임비] ?? 0),
    미팅사유: String(r[COL.미팅사유] ?? ""),
    계약조건: String(r[COL.계약조건] ?? ""),
    표시상세: r[COL.표시상세] ? String(r[COL.표시상세]) : undefined,
    표시요약: r[COL.표시요약] ? String(r[COL.표시요약]) : undefined,
    계약합성라인: r[COL.계약합성라인] ? String(r[COL.계약합성라인]) : undefined,
    previousMeetingId: r[COL.previousMeetingId]
      ? String(r[COL.previousMeetingId])
      : undefined,
    주차: r[COL.주차] ? Number(r[COL.주차]) : undefined,
    업체정보: buildCompanyInfo(r),
    // AO~AP 이월 깃발 (arena-carryover §3) — 읽기 전용. 쓰기(split A:M/P/R/T~AN)는 비접촉.
    구분: String(r[40] ?? "").trim(),
    이월원본행id: String(r[41] ?? "").trim(),
  });
  return parsed.success ? parsed.data : null;
}

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
): Promise<void> {
  const validated = Meeting.parse(meeting);
  const row = meetingToRow(validated);
  const targetRow = await findFirstEmptyRow(spreadsheetId);
  await writeMeetingRowSplit(spreadsheetId, targetRow, row);
  mirrorSheetRow({ spreadsheetId, tab: "meetings", rowKey: validated.id, payload: validated }); // P1
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
  mirrorSheetRow({ spreadsheetId, tab: "meetings", rowKey: id, payload: merged }); // P1

  void FORMULA_COL_INDICES; // 인덱스 정의 보존 (다른 호출자가 참조 가능)
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
  mirrorClearRow({ spreadsheetId, tab: "meetings", rowKey: id }); // P1 — _cleared 마킹
}
