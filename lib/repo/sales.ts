/**
 * Layer: repo — 01 영업관리 탭 I/O.
 *
 * 가드레일:
 *   • 4지표(E~H)와 실적(Q~T)만 쓰기 허용. I~P는 시트 수식 — 쓰기 시도 시 throw.
 *   • 좌표는 N1(수강시작일) + (주차, 요일, 채널) 공식으로 계산. 날짜 하드코딩 X.
 *
 * SSOT: docs/domains/sheet-structure.md §2
 */
import { SHEET_RANGES } from "@/config";
import {
  ChannelDailyRow,
  CHANNEL_ORDER,
  Channel,
  DailyRevenue,
} from "@/types";
import { sheetsClient } from "./sheets-client";

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

/**
 * 수강시작일을 N1에서 읽음.
 * 시트는 보통 날짜 셀로 저장되며 "M/d" 또는 "yyyy-mm-dd" 등 다양한 표기 가능 →
 * UNFORMATTED_VALUE를 받아 직렬값(epoch days since 1899-12-30)으로 파싱.
 */
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
      throw new Error(`[sales.ts] N1 파싱 실패: ${raw}`);
    }
    return parsed;
  }
  throw new Error(`[sales.ts] N1 형식 미지원: ${typeof raw}`);
}

/** 한 행의 4지표(E~H) update. */
export async function writeChannelDailyRow(
  spreadsheetId: string,
  row: ChannelDailyRow,
): Promise<void> {
  const validated = ChannelDailyRow.parse(row);
  const courseStart = await readCourseStart(spreadsheetId);
  const targetDate = parseISO(validated.date);
  const sheetRow = salesRowFor(targetDate, validated.channel, courseStart);

  const cols = SHEET_RANGES.sales.metricCols;
  // E~H 가드
  for (const col of [
    cols.production,
    cols.inflow,
    cols.contactProgress,
    cols.contactSuccess,
  ]) {
    assertWritableCol(col, "writeChannelDailyRow");
  }

  const range = `${tabRef(SHEET_RANGES.sales.tab)}!${cols.production}${sheetRow}:${cols.contactSuccess}${sheetRow}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          validated.production,
          validated.inflow,
          validated.contactProgress,
          validated.contactSuccess,
        ],
      ],
    },
  });
}

/**
 * 일별 실적(수납) Q~T를 그 날의 매입DB 행(첫 채널)에 기록.
 * 가정: 한 날짜에 Q~T는 1개 값만 존재 (4채널 행 중 첫 행에만).
 */
export async function writeDailyRevenue(
  spreadsheetId: string,
  revenue: DailyRevenue,
): Promise<void> {
  const validated = DailyRevenue.parse(revenue);
  const courseStart = await readCourseStart(spreadsheetId);
  const targetDate = parseISO(validated.date);
  // 매입DB 행 (그 날짜의 첫 채널 행)
  const sheetRow = salesRowFor(targetDate, "매입DB", courseStart);

  const cols = SHEET_RANGES.sales.revenueCols;
  for (const col of [
    cols.approvalCount,
    cols.paymentCount,
    cols.paymentAmount,
    cols.agencyNote,
  ]) {
    assertWritableCol(col, "writeDailyRevenue");
  }

  const range = `${tabRef(SHEET_RANGES.sales.tab)}!${cols.approvalCount}${sheetRow}:${cols.agencyNote}${sheetRow}`;
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          validated.approvalCount,
          validated.paymentCount,
          validated.paymentAmount,
          validated.agencyNote,
        ],
      ],
    },
  });
}

/**
 * 한 주차 분량의 4지표 4채널 (28개 행)을 읽음.
 * 결과: 일별×채널별 ChannelDailyRow + 일별 DailyRevenue (7개).
 */
export async function readWeek(
  spreadsheetId: string,
  weekIndex: number,
): Promise<{ rows: ChannelDailyRow[]; revenues: DailyRevenue[] }> {
  if (weekIndex < 1 || weekIndex > 10) {
    throw new Error(`주차 범위 밖: ${weekIndex} (1~10)`);
  }
  const courseStart = await readCourseStart(spreadsheetId);

  const startRow =
    SHEET_RANGES.sales.blockStart +
    (weekIndex - 1) * SHEET_RANGES.sales.blockStride;
  const endRow = startRow + 27; // 28행

  // C(날짜) ~ T(수납비고)까지 한 번에 읽기
  const range = `${tabRef(SHEET_RANGES.sales.tab)}!C${startRow}:T${endRow}`;
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const data = (res.data.values ?? []) as (string | number | boolean)[][];

  const rows: ChannelDailyRow[] = [];
  const revenues: DailyRevenue[] = [];
  for (let i = 0; i < 28; i++) {
    const r = data[i] ?? [];
    // 컬럼 인덱스 (C 기준 0): C=0날짜, D=1채널, E=2생산, F=3유입, G=4컨택진행, H=5컨택성공,
    // I=6 ... P=13, Q=14, R=15, S=16, T=17
    const dateRaw = r[0];
    const channelRaw = r[1];
    if (dateRaw === undefined || channelRaw === undefined) continue;

    const dateStr = serialOrStringToISO(dateRaw);
    if (!dateStr) continue;
    const parsed = ChannelDailyRow.safeParse({
      date: dateStr,
      channel: String(channelRaw),
      production: Number(r[2] ?? 0),
      inflow: Number(r[3] ?? 0),
      contactProgress: Number(r[4] ?? 0),
      contactSuccess: Number(r[5] ?? 0),
    });
    if (parsed.success) rows.push(parsed.data);

    // 매입DB 행(채널 0번, 4행 단위 첫 행)에서만 revenue 추출
    const dayIdxInWeek = Math.floor(i / 4);
    const channelIdxInDay = i % 4;
    if (channelIdxInDay === 0) {
      const rev = DailyRevenue.safeParse({
        date: dateStr,
        approvalCount: Number(r[14] ?? 0),
        paymentCount: Number(r[15] ?? 0),
        paymentAmount: Number(r[16] ?? 0),
        agencyNote: String(r[17] ?? ""),
      });
      if (rev.success) revenues.push(rev.data);
      void dayIdxInWeek; // (currently unused; reserved for future ordering logic)
    }
  }

  void courseStart; // (currently unused in this read path; kept for symmetry/validation)
  return { rows, revenues };
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
