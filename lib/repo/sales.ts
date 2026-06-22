/**
 * Layer: repo — 01 영업관리 탭 I/O. 가드: E~H·Q~T 만 쓰기, I~P 수식(쓰기 throw).
 * 좌표 = O1(수강시작일) + (주차,요일,채널) 공식. SSOT: docs/domains/sheet-structure.md §2
 */
import { SHEET_RANGES } from "@/config";
import {
  ChannelDailyRow,
  CHANNEL_ORDER,
  Channel,
} from "@/types";
import { sheetsClient } from "./sheets-client";
import { parseWeekRows } from "./week-parse";

// ── 좌표 계산 (순수 함수, 단위 테스트 가능) ───────────────────

/** 두 날짜의 일수 차이 (양수 또는 음수). */
export function diffDays(later: Date, earlier: Date): number {
  return Math.round(
    (later.getTime() - earlier.getTime()) / 86_400_000,
  );
}

/**
 * 수강시작일 기준 주차 (1~10).
 * 시작일 당일 = 1주차. 시작일 + 7일 = 2주차. ...
 */
export function weekIndexOf(date: Date, courseStart: Date): number {
  const diff = diffDays(date, courseStart);
  if (diff < 0) return 0; // 수강 시작 전
  return Math.floor(diff / 7) + 1;
}

/** 그 주차의 시작일(시작일과 같은 요일). */
export function weekStartOf(date: Date, courseStart: Date): Date {
  const week = weekIndexOf(date, courseStart);
  if (week === 0) return courseStart;
  const offset = (week - 1) * 7;
  const d = new Date(courseStart);
  d.setDate(d.getDate() + offset);
  return d;
}

/**
 * 영업관리 한 행의 행 번호 (1-based).
 * row = blockStart + (week-1) * blockStride + dayIdx * 4 + channelIdx
 */
export function salesRowFor(
  date: Date,
  channel: Channel,
  courseStart: Date,
): number {
  const week = weekIndexOf(date, courseStart);
  if (week < 1 || week > 10) {
    throw new Error(
      `영업관리 좌표 계산 실패: 날짜 ${fmtISO(date)}는 편집 가능 기간(1~10주) 밖입니다.`,
    );
  }
  const weekStart = weekStartOf(date, courseStart);
  const dayIdx = diffDays(date, weekStart); // 0~6 (시작 요일이 0)
  const channelIdx = CHANNEL_ORDER.indexOf(channel);
  if (channelIdx < 0) {
    throw new Error(`알 수 없는 채널: ${String(channel)}`);
  }
  return (
    SHEET_RANGES.sales.blockStart +
    (week - 1) * SHEET_RANGES.sales.blockStride +
    dayIdx * 4 +
    channelIdx
  );
}

/**
 * 한 주의 영업관리 E~H 합계 — 컨택탭 헤더 funnel 표시용(2026-05-16).
 * weekly sum cell 미의존: 그 주차 28 데이터 row(7일×4채널) 직접 합산(셀병합·sum 누락에 robust). 1 read.
 */
export async function readWeekFunnel(
  spreadsheetId: string,
  week: number,
): Promise<{ 생산: number; 유입: number; 컨택진행: number; 미팅예약: number }> {
  // 편집 가능 기간 (1~10주) 밖이면 0 반환 — 안전 fallback.
  if (week < 1 || week > 10) {
    return { 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0 };
  }
  const startRow =
    SHEET_RANGES.sales.blockStart +
    (week - 1) * SHEET_RANGES.sales.blockStride;
  const endRow = startRow + 27; // 28 data rows (7일 × 4채널)
  const range = `${tabRef(SHEET_RANGES.sales.tab)}!E${startRow}:H${endRow}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = res.data.values ?? [];
  const sumCol = (idx: number): number =>
    values.reduce<number>((acc, row) => {
      const v = row?.[idx];
      return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
    }, 0);
  return {
    생산: sumCol(0),
    유입: sumCol(1),
    컨택진행: sumCol(2),
    미팅예약: sumCol(3),
  };
}

// ── 가드: 시트 수식 컬럼 쓰기 차단 ────────────────────────────
function assertWritableCol(col: string, context: string): void {
  if (
    (SHEET_RANGES.sales.formulaCols as readonly string[]).includes(col)
  ) {
    throw new Error(
      `[sales.ts] 영업관리!${col}열은 시트 수식 자동 집계 영역 — 쓰기 금지. ` +
        `(컨텍스트: ${context}) 참고: docs/domains/sheet-structure.md §2`,
    );
  }
}

// ── 유틸 ──────────────────────────────────────────────────────
function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function tabRef(tab: string): string {
  // 탭 이름에 공백·괄호가 있으면 작은따옴표 wrapping
  return /[\s()]/.test(tab) ? `'${tab}'` : tab;
}

// ── 시트 I/O ──────────────────────────────────────────────────

/** 수강시작일 O1 read. UNFORMATTED_VALUE 로 직렬값(epoch days since 1899-12-30) 파싱. */
export async function readCourseStart(
  spreadsheetId: string,
): Promise<Date> {
  const range = `${tabRef(SHEET_RANGES.sales.tab)}!${SHEET_RANGES.sales.startDateCell}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const raw = res.data.values?.[0]?.[0];
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(
      `[sales.ts] ${range}에 수강시작일이 비어있습니다. 시트에 입력해주세요.`,
    );
  }
  // 숫자(시리얼) 또는 문자열 둘 다 처리
  if (typeof raw === "number") {
    // Google Sheets serial: days since 1899-12-30
    const ms = (raw - 25569) * 86_400_000;
    return new Date(ms);
  }
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`[sales.ts] O1(수강시작일) 파싱 실패: ${raw}`);
    }
    return parsed;
  }
  throw new Error(`[sales.ts] O1 형식 미지원: ${typeof raw}`);
}

/** 영업관리 O2 종강총회일(=수료일) 직접 읽기. ADR-0005: O2 직접값만 신뢰(offset 강제 X).
 *  헤더 D-day·메인 배너 표시용. */
export async function readGraduation(
  spreadsheetId: string,
): Promise<Date> {
  const range = `${tabRef(SHEET_RANGES.sales.tab)}!${SHEET_RANGES.sales.graduationDateCell}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const raw = res.data.values?.[0]?.[0];
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(
      `[sales.ts] ${range}에 종강총회일이 비어있습니다. 시트 O2에 입력 또는 수식(7기+ =O1+50, ADR-0005) 설정 필요.`,
    );
  }
  if (typeof raw === "number") {
    const ms = (raw - 25569) * 86_400_000;
    return new Date(ms);
  }
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`[sales.ts] O2(종강총회) 파싱 실패: ${raw}`);
    }
    return parsed;
  }
  throw new Error(`[sales.ts] O2 형식 미지원: ${typeof raw}`);
}

/**
 * 영업관리 B3/C3에서 사용자 프로필(기수/이름) 읽기.
 * 사용자가 시트에 직접 입력한 값 — 마스터 레지스트리(users 탭)와 별개의 SSOT.
 * 헤더 컴포넌트가 "{기수} {이름}" 표시에 사용.
 */
export async function readProfile(
  spreadsheetId: string,
): Promise<{ cohort: string; name: string }> {
  const range = `${tabRef(SHEET_RANGES.sales.tab)}!B3:C3`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const row = res.data.values?.[0] ?? [];
  return {
    cohort: String(row[0] ?? "").trim(),
    name: String(row[1] ?? "").trim(),
  };
}

/**
 * loadMe + enrichUsersWithDates 공용 — B3:C3 + O1 + O2 + 8주 funnel 데이터
 * 블록을 단일 batchGet 으로. stats 는 데이터 컬럼 직접 합산 (sumFunnelDataRows).
 */
export async function readProfileBundle(spreadsheetId: string): Promise<{
  cohort: string;
  name: string;
  courseStart: Date;
  graduation: Date;
  stats: { 미팅예정: number; 미팅완료: number; 계약: number };
}> {
  const tab = tabRef(SHEET_RANGES.sales.tab);
  const blockStart = SHEET_RANGES.sales.blockStart;
  const blockStride = SHEET_RANGES.sales.blockStride;
  const lastRow = blockStart + 7 * blockStride + 27; // 8주차 마지막 데이터 행
  const ranges = [
    `${tab}!B3:C3`,
    `${tab}!${SHEET_RANGES.sales.startDateCell}`,
    `${tab}!${SHEET_RANGES.sales.graduationDateCell}`,
    // 2026-05-19: E4:E6 header 합산 셀 비어 0 사고 → E~N 224 데이터 row 직접 합산(trailer 제외).
    `${tab}!E${blockStart}:N${lastRow}`,
  ];
  const res = await sheetsClient().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const ranges_ = res.data.valueRanges ?? [];
  const profileRow = (ranges_[0]?.values?.[0] ?? []) as unknown[];
  const startRaw = ranges_[1]?.values?.[0]?.[0];
  const gradRaw = ranges_[2]?.values?.[0]?.[0];
  const funnelRows = (ranges_[3]?.values ?? []) as unknown[][];

  return {
    cohort: String(profileRow[0] ?? "").trim(),
    name: String(profileRow[1] ?? "").trim(),
    courseStart: parseSerialOrString(startRaw, "O1(수강시작일)"),
    graduation: parseSerialOrString(gradRaw, "O2(종강총회)"),
    stats: sumFunnelDataRows(funnelRows, blockStride),
  };
}

/**
 * 영업관리 E~N 데이터 블록 8주 누적 funnel 합산 (2026-05-19, E 기준 H=3/L=7/N=9).
 * 미팅예정=ΣH(웹), 미팅완료=ΣL, 계약=ΣN. 각 주 28 데이터 row 만 (trailer 제외).
 */
function sumFunnelDataRows(
  rows: unknown[][],
  blockStride: number,
): { 미팅예정: number; 미팅완료: number; 계약: number } {
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;
  let 미팅예정 = 0;
  let 미팅완료 = 0;
  let 계약 = 0;
  for (let week = 0; week < 8; week++) {
    for (let offset = 0; offset < 28; offset++) {
      const r = rows[week * blockStride + offset] ?? [];
      미팅예정 += num(r[3]); // H
      미팅완료 += num(r[7]); // L
      계약 += num(r[9]); // N
    }
  }
  return { 미팅예정, 미팅완료, 계약 };
}

function parseSerialOrString(raw: unknown, label: string): Date {
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(`[sales.ts] ${label}이 비어있습니다.`);
  }
  if (typeof raw === "number") {
    const ms = (raw - 25569) * 86_400_000;
    return new Date(ms);
  }
  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`[sales.ts] ${label} 파싱 실패: ${raw}`);
    }
    return parsed;
  }
  throw new Error(`[sales.ts] ${label} 형식 미지원: ${typeof raw}`);
}

/**
 * 영업관리 B3/C3에 기수/이름 쓰기.
 * Self-claim 흐름에서 사용 — 시트 템플릿이 빈 상태로 만들어진 경우 web 이 직접 작성.
 */
export async function writeProfile(
  spreadsheetId: string,
  cohort: string,
  name: string,
): Promise<void> {
  const range = `${tabRef(SHEET_RANGES.sales.tab)}!B3:C3`;
  const cohortNum = String(cohort).replace(/기\s*$/, "").trim();
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[cohortNum, name.trim()]] },
  });
}

/** 한 행의 4지표(E~H) update. */
export async function writeChannelDailyRow(
  spreadsheetId: string,
  row: ChannelDailyRow,
): Promise<void> {
  await batchWriteChannelDailyRows(spreadsheetId, [row]);
}

/**
 * 여러 행의 4지표(E~H)를 한 번의 batchUpdate로 저장.
 * readCourseStart를 1회만 호출 → Sheets Read quota 절약.
 * saveContactMetrics (4채널 동시 저장 시) 4 Read → 1 Read.
 */
export async function batchWriteChannelDailyRows(
  spreadsheetId: string,
  rows: ChannelDailyRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const courseStart = await readCourseStart(spreadsheetId); // 1 Read

  const cols = SHEET_RANGES.sales.metricCols;
  // F~H 는 항상 쓰기. 직접생산만 E(생산)=유입 미러 추가(ADR-0024) — 그 외 채널 E 는 ADR-0020 DB집계 소유.
  for (const col of [cols.production, cols.inflow, cols.contactProgress, cols.meetingReservation]) {
    assertWritableCol(col, "batchWriteChannelDailyRows");
  }

  const tab = tabRef(SHEET_RANGES.sales.tab);
  const data = rows.map((row) => {
    const validated = ChannelDailyRow.parse(row);
    const sheetRow = salesRowFor(parseISO(validated.date), validated.channel, courseStart);
    // 직접생산: E=유입 미러 + F~H (직접생산 생산 = 유입, ADR-0024).
    if (validated.channel === "직접생산") {
      return {
        range: `${tab}!${cols.production}${sheetRow}:${cols.meetingReservation}${sheetRow}`,
        values: [[validated.inflow, validated.inflow, validated.contactProgress, validated.meetingReservation]],
      };
    }
    return {
      range: `${tab}!${cols.inflow}${sheetRow}:${cols.meetingReservation}${sheetRow}`,
      values: [[validated.inflow, validated.contactProgress, validated.meetingReservation]],
    };
  });

  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}

/** 한 채널의 영업관리 F(유입) 을 [startISO, endISO] 기간 합산 — 직접생산 M 동기화용(ADR-0024).
 *  편집 가능 기간(1~10주) 안 날짜만, readWeek(주차 블록) 재사용. */
export async function sumChannelInflowOverPeriod(
  spreadsheetId: string,
  channel: Channel,
  startISO: string,
  endISO: string,
): Promise<number> {
  const courseStart = await readCourseStart(spreadsheetId);
  const w1 = weekIndexOf(parseISO(startISO), courseStart);
  const w2 = weekIndexOf(parseISO(endISO), courseStart);
  const from = Math.max(1, Math.min(w1, w2));
  const to = Math.min(10, Math.max(w1, w2));
  let sum = 0;
  for (let w = from; w <= to; w++) {
    const { rows } = await readWeek(spreadsheetId, w);
    for (const r of rows) {
      if (r.channel === channel && r.date >= startISO && r.date <= endISO) sum += r.inflow;
    }
  }
  return sum;
}

/** 생산(E) 단일 셀 기입 — DB생산 집계 소유 app-derived 값(PR1/ADR-0020). 항상 overwrite,
 *  편집기간(1~10주) 밖이면 skip. §2.5 비대상(파생값 — 기존 E:H writer 와 동일 무가드). */
export async function writeProductionCell(
  spreadsheetId: string,
  date: string,
  channel: Channel,
  count: number,
): Promise<void> {
  const courseStart = await readCourseStart(spreadsheetId);
  let sheetRow: number;
  try {
    sheetRow = salesRowFor(parseISO(date), channel, courseStart);
  } catch {
    return; // 편집 가능 기간(1~10주) 밖 — 영업관리 E 대상 아님
  }
  const cols = SHEET_RANGES.sales.metricCols;
  assertWritableCol(cols.production, "writeProductionCell");
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range: `${tabRef(SHEET_RANGES.sales.tab)}!${cols.production}${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[count]] },
  });
}

/** 영업관리 H(미팅예약) 채널×날짜 -1 (일정탭 삭제 cascade, 2026-05-19). 0 미만 no-op. */
export async function decrementMeetingReservation(
  spreadsheetId: string,
  date: string,
  channel: Channel,
): Promise<{ before: number; after: number }> {
  const courseStart = await readCourseStart(spreadsheetId);
  const sheetRow = salesRowFor(parseISO(date), channel, courseStart);
  const col = SHEET_RANGES.sales.metricCols.meetingReservation;
  assertWritableCol(col, "decrementMeetingReservation");
  const tab = tabRef(SHEET_RANGES.sales.tab);
  const range = `${tab}!${col}${sheetRow}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const cur = Number(res.data.values?.[0]?.[0] ?? 0);
  const before = Number.isFinite(cur) ? cur : 0;
  const after = Math.max(0, before - 1);
  if (after === before) return { before, after };
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[after]] },
  });
  return { before, after };
}

/** 한 주차 4지표 4채널(28행) read. Q~T(deprecated 실적)는 안 읽음 — 02 계약수납관리로 이전. */
export async function readWeek(
  spreadsheetId: string,
  weekIndex: number,
): Promise<{ rows: ChannelDailyRow[] }> {
  if (weekIndex < 1 || weekIndex > 10) {
    throw new Error(`주차 범위 밖: ${weekIndex} (1~10)`);
  }
  // 좌표는 weekIndex 로 계산 — courseStart 불필요(과거 dead read 제거, 2026-06).
  const startRow =
    SHEET_RANGES.sales.blockStart +
    (weekIndex - 1) * SHEET_RANGES.sales.blockStride;
  const endRow = startRow + 27; // 28행

  // C(날짜) ~ H(미팅예약)까지만 read — Q~T(일별 실적)는 deprecated
  const range = `${tabRef(SHEET_RANGES.sales.tab)}!C${startRow}:H${endRow}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const data = (res.data.values ?? []) as (string | number | boolean)[][];
  // 날짜 병합 forward-fill + 셀별 tolerant 는 parseWeekRows(순수)에 위임.
  return { rows: parseWeekRows(data, serialOrStringToISO) };
}

function serialOrStringToISO(v: string | number | boolean): string | null {
  if (typeof v === "number") {
    const ms = (v - 25569) * 86_400_000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return fmtISO(d);
  }
  if (typeof v === "string" && v) {
    // "M/d" 같은 짧은 표기는 N1과 결합 없이 파싱 어려움 → 호출 측에서 처리
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return fmtISO(parsed);
  }
  return null;
}
