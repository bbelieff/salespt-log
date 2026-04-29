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
import { sheetsClient } from "./sheets-client";

function tabRef(tab: string): string {
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

// ── 시트 직렬값 ↔ ISO 변환 ─────────────────────────────────────
// USER_ENTERED로 쓴 "2026-04-28" / "10:00"은 시트가 자동으로 날짜·시간 값으로
// 변환해 저장. 다시 읽을 때 FORMATTED_VALUE는 로케일 형식 (예: "2026. 4. 28.")
// 으로 와서 zod regex와 안 맞음 → SERIAL_NUMBER로 받아 ISO로 복원.

function serialToISODate(v: unknown): string {
  if (typeof v === "string") {
    // 이미 "YYYY-MM-DD" 텍스트라면 그대로
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // "M/D/YYYY" 또는 "YYYY/M/D" 같은 변종 → Date 파싱 시도
    const d = new Date(v);
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
    // "10:00:00" → "10:00"
    const m = v.match(/^(\d{2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
    return "";
  }
  if (typeof v === "number") {
    // 0~1 사이 분수 = 하루 중 비율. 또는 정수 + 분수 (날짜+시간 합쳐진 경우)
    const fraction = ((v % 1) + 1) % 1; // 음수 안전
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

/** Meeting → 시트 1행 배열 (A~S). 수식 컬럼은 빈 문자열로 둠. */
function meetingToRow(m: Meeting): (string | number | boolean)[] {
  const row: (string | number | boolean)[] = new Array(19).fill("");
  row[COL.id] = m.id;
  row[COL.예약일] = m.예약일;
  row[COL.예약시각] = m.예약시각;
  row[COL.미팅날짜] = m.미팅날짜;
  row[COL.미팅시간] = m.미팅시간;
  row[COL.channel] = m.channel;
  row[COL.업체명] = m.업체명;
  row[COL.장소] = m.장소;
  row[COL.예약비고] = m.예약비고 ?? "";
  row[COL.상태] = m.상태;
  row[COL.계약여부] = m.계약여부;
  row[COL.수임비] = m.수임비;
  row[COL.미팅사유] = m.미팅사유 ?? "";
  row[COL.계약조건] = m.계약조건 ?? "";
  row[COL.previousMeetingId] = m.previousMeetingId ?? "";
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
  });
  return parsed.success ? parsed.data : null;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * 헤더 다음 첫 번째 빈 행 번호(1-based) 찾기.
 *
 * `values.append INSERT_ROWS`는 K열(계약여부) 같이 데이터 검증으로
 * FALSE가 채워진 phantom 행들도 "데이터 있는 행"으로 보고 그 너머에
 * append하기 때문에, A열(id) 기준으로 진짜 빈 행을 찾는 패턴 필요.
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

/**
 * 미팅 1건 append. id 중복 검증은 호출 측 책임.
 *
 * `values.append`로 INSERT_ROWS 하지 않고, A열(id) 기준 빈 행을 찾아
 * 정확히 그 행에 update. K열 phantom FALSE 영향 X.
 */
export async function appendMeeting(
  spreadsheetId: string,
  meeting: Meeting,
): Promise<void> {
  const validated = Meeting.parse(meeting);
  const row = meetingToRow(validated);
  const targetRow = await findFirstEmptyRow(spreadsheetId);
  const range = `${tabRef(TAB)}!A${targetRow}:S${targetRow}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

/**
 * id로 행 번호 찾기 (1-based, 없으면 null).
 * 헤더가 1행이므로 데이터는 2행부터 → 검색 결과 인덱스 + 2.
 */
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
  const range = `${tabRef(TAB)}!A${sheetRow}:S${sheetRow}`;
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

/**
 * 특정 행 부분 update.
 * 수식 컬럼(N/O/Q/S)은 자동 제외.
 */
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

  // 수식 컬럼은 빈 문자열로 보내면 시트가 기존 수식을 덮어쓸 수 있음 →
  // 해당 셀은 update 범위에서 제외하고 두 번 나눠 쓰기.
  // 간단 처리: A~M (수식 N/O 제외 직전), P (계약조건), R (previousMeetingId) 만 update.
  // (Q 수식은 시트 자동, S 수식도 자동, N/O 수식 자동)

  const A_to_M = fullRow.slice(0, 13); // A=0 ~ M=12
  const P_only = [fullRow[COL.계약조건]];
  const R_only = [fullRow[COL.previousMeetingId]];

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
      ],
    },
  });

  void FORMULA_COL_INDICES; // 인덱스 정의 보존 (다른 호출자가 참조 가능)
}

/** 날짜로 미팅 조회. type='reservation'이면 예약일(B), 'meeting'이면 미팅날짜(D) 기준. */
export async function findByDate(
  spreadsheetId: string,
  date: string,
  type: "reservation" | "meeting" = "meeting",
): Promise<Meeting[]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE_ALL,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const all = (res.data.values ?? []) as unknown[][];
  const targetCol = type === "reservation" ? COL.예약일 : COL.미팅날짜;
  const result: Meeting[] = [];
  // 같은 id가 여러 행에 있으면 첫 번째만 사용 (방어적 dedupe)
  const seenIds = new Set<string>();
  for (const r of all) {
    const rowDate = serialToISODate(r[targetCol]);
    if (rowDate !== date) continue;
    const parsed = rowToMeeting(r);
    if (!parsed) continue;
    if (seenIds.has(parsed.id)) continue;
    seenIds.add(parsed.id);
    result.push(parsed);
  }
  return result;
}

/** id로 행 클리어 (실제 삭제 아니라 빈 값으로 update). */
export async function clearMeeting(
  spreadsheetId: string,
  id: string,
): Promise<void> {
  const sheetRow = await findRowById(spreadsheetId, id);
  if (sheetRow === null) return;
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
      ],
    },
  });
}
