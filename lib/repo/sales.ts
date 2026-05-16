/**
 * Layer: repo — 01 영업관리 탭 I/O.
 *
 * 가드레일:
 *   • 4지표(E~H)와 실적(Q~T)만 쓰기 허용. I~P는 시트 수식 — 쓰기 시도 시 throw.
 *   • 좌표는 O1(수강시작일) + (주차, 요일, 채널) 공식으로 계산. 날짜 하드코딩 X.
 *
 * SSOT: docs/domains/sheet-structure.md §2
 */
import { SHEET_RANGES } from "@/config";
import {
  ChannelDailyRow,
  CHANNEL_ORDER,
  Channel,
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

/**
 * 한 주의 영업관리 E~H (생산/유입/컨택진행/미팅예약) 합계 — 컨택탭 헤더의
 * 금주 채널 funnel 표시용 (2026-05-16).
 *
 * 시트의 weekly sum cell 에 의존하지 않고, 그 주차의 28 데이터 row (7일 × 4채널)
 * 를 직접 합산. 셀병합 또는 옛 template 의 sum 셀 누락에도 robust.
 *
 * 1주차 row range: rows 10..37 (blockStart=10, 28 data rows).
 * 1 batchGet 1 range — quota 1 read.
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

/**
 * 수강시작일을 O1에서 읽음 (N1은 "시작일" 라벨, 값은 O1).
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
      throw new Error(`[sales.ts] O1(수강시작일) 파싱 실패: ${raw}`);
    }
    return parsed;
  }
  throw new Error(`[sales.ts] O1 형식 미지원: ${typeof raw}`);
}

/**
 * 영업관리 O2에서 종강총회일(=수료일) 직접 읽기 (N2는 "종강총회" 라벨).
 * ADR-0005: O2 는 7기+ `=O1+50`, 6기 legacy `=O1+57` 또는 직접 입력.
 * 코드는 O2 직접값만 신뢰 — offset 강제 안 함.
 * 헤더 D-day 와 메인 배너 종강총회일 표시에 사용.
 */
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
 * loadMe + enrichUsersWithDates 공용 — B3:C3 (프로필) + O1 (수강시작일) +
 * O2 (종강총회일) + **E4:E6 (8주 funnel 누적: 미팅예약/미팅완료/계약)** 을
 * **단일 batchGet** 호출로 가져옴.
 *
 * 기존 readProfile/readCourseStart/readGraduation 을 Promise.all 로 호출하면
 * round-trip 발생 → 헤더 로드 지연 + Sheets quota 압박. batchGet 1회 + 4 ranges
 * 로 통합 (range 추가는 quota 영향 없음 — batchGet 1 call 단위).
 *
 * **2026-05-16** — stats(E4:E6) 추가 — admin/trainer 페이지 수강생 카드에서
 * "예정·완료·계약" 8주 누적 표시용. /schedule funnel 과 동일 SSOT.
 */
export async function readProfileBundle(spreadsheetId: string): Promise<{
  cohort: string;
  name: string;
  courseStart: Date;
  graduation: Date;
  stats: { 미팅예정: number; 미팅완료: number; 계약: number };
}> {
  const tab = tabRef(SHEET_RANGES.sales.tab);
  const ranges = [
    `${tab}!B3:C3`,
    `${tab}!${SHEET_RANGES.sales.startDateCell}`,
    `${tab}!${SHEET_RANGES.sales.graduationDateCell}`,
    `${tab}!E4:E6`, // 8주 누적 funnel: E4=미팅예약, E5=미팅완료, E6=계약
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
  const statsRows = ranges_[3]?.values ?? [];
  const statsNum = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;

  return {
    cohort: String(profileRow[0] ?? "").trim(),
    name: String(profileRow[1] ?? "").trim(),
    courseStart: parseSerialOrString(startRaw, "O1(수강시작일)"),
    graduation: parseSerialOrString(gradRaw, "O2(종강총회)"),
    stats: {
      미팅예정: statsNum(statsRows[0]?.[0]),
      미팅완료: statsNum(statsRows[1]?.[0]),
      계약: statsNum(statsRows[2]?.[0]),
    },
  };
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
  for (const col of [
    cols.production,
    cols.inflow,
    cols.contactProgress,
    cols.meetingReservation,
  ]) {
    assertWritableCol(col, "batchWriteChannelDailyRows");
  }

  const tab = tabRef(SHEET_RANGES.sales.tab);
  const data = rows.map((row) => {
    const validated = ChannelDailyRow.parse(row);
    const targetDate = parseISO(validated.date);
    const sheetRow = salesRowFor(targetDate, validated.channel, courseStart);
    return {
      range: `${tab}!${cols.production}${sheetRow}:${cols.meetingReservation}${sheetRow}`,
      values: [[
        validated.production,
        validated.inflow,
        validated.contactProgress,
        validated.meetingReservation,
      ]],
    };
  });

  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}

/**
 * 한 주차 분량의 4지표 4채널 (28개 행)을 읽음.
 * Q~T(deprecated 일별 실적)는 더 이상 read하지 않음 — PR #38·39+에서
 * 02 계약수납관리로 모델 이전됨.
 */
export async function readWeek(
  spreadsheetId: string,
  weekIndex: number,
): Promise<{ rows: ChannelDailyRow[] }> {
  if (weekIndex < 1 || weekIndex > 10) {
    throw new Error(`주차 범위 밖: ${weekIndex} (1~10)`);
  }
  const courseStart = await readCourseStart(spreadsheetId);

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

  const rows: ChannelDailyRow[] = [];
  for (let i = 0; i < 28; i++) {
    const r = data[i] ?? [];
    // 컬럼 인덱스 (C 기준 0): C=0날짜, D=1채널, E=2생산, F=3유입, G=4컨택진행, H=5미팅예약
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
      meetingReservation: Number(r[5] ?? 0),
    });
    if (parsed.success) rows.push(parsed.data);
  }

  void courseStart;
  return { rows };
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
