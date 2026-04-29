/**
 * Layer: service — 컨택탭 유스케이스.
 *
 * 컨택탭은 "하루 단위" 화면이지만 실제 시트는 "주차 단위" 블록 → 한 번에 한 주를 읽고
 * 그 안에서 그 날의 4채널 행을 추출하는 패턴.
 *
 * 시안: docs/design/prototypes/contact-daily-input.html (v7)
 */
import { findUserByEmail } from "@/repo/users";
import {
  batchWriteChannelDailyRows,
  readCourseStart,
  readWeek,
  weekIndexOf,
} from "@/repo/sales";
import {
  appendMeeting,
  clearMeeting,
  findByDate,
  findByDateRange,
  findById,
  updateMeeting,
} from "@/repo/meetings";
import {
  Channel,
  ChannelDailyRow,
  CHANNEL_ORDER,
  Meeting,
} from "@/types";

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`[contact] 등록되지 않은 사용자: ${email}`);
  }
  return user.spreadsheetId;
}

// ── DTO ───────────────────────────────────────────────────────

export interface ContactDayView {
  date: string;
  weekIndex: number; // 1~10
  /** 수강시작일 (YYYY-MM-DD) — UI에서 7일 요일 바 매핑에 사용 */
  courseStart: string;
  channels: Record<Channel, ChannelDailyRowMetrics>;
  meetings: Meeting[];
}

export interface ChannelDailyRowMetrics {
  production: number;
  inflow: number;
  contactProgress: number;
  contactSuccess: number;
}

const EMPTY_METRICS: ChannelDailyRowMetrics = {
  production: 0,
  inflow: 0,
  contactProgress: 0,
  contactSuccess: 0,
};

// ── Public API ─────────────────────────────────────────────────

/**
 * 한 날짜의 4채널 4지표 + 그 날 미팅 목록.
 * UI는 이 결과를 받아 컨택탭에 그대로 렌더.
 */
export async function loadDay(
  email: string,
  date: string,
): Promise<ContactDayView> {
  const spreadsheetId = await resolveSheet(email);
  const courseStart = await readCourseStart(spreadsheetId);
  const targetDate = parseISO(date);
  const week = weekIndexOf(targetDate, courseStart);
  if (week < 1 || week > 10) {
    throw new Error(`[contact] 편집 가능 기간 외: ${date}`);
  }

  const { rows } = await readWeek(spreadsheetId, week);
  // ⭐ 컨택관리 탭은 "예약일(컨택한 날)" 기준으로 미팅 조회.
  // 4/28에 컨택해서 4/29에 잡힌 미팅도 4/28 view에 보여야 함.
  // 미팅날짜 기준 조회는 일정·계약 탭(PR 3) 몫.
  // SSOT: sheet-structure.md §2 영업관리!I = 예약일 TEXTJOIN
  const meetings = await findByDate(spreadsheetId, date, "reservation");

  // 그 날짜의 4채널만 필터
  const dayRows = rows.filter((r) => r.date === date);
  const channels: Record<Channel, ChannelDailyRowMetrics> = {
    매입DB: { ...EMPTY_METRICS },
    직접생산: { ...EMPTY_METRICS },
    현수막: { ...EMPTY_METRICS },
    "콜·지·기·소": { ...EMPTY_METRICS },
  };
  for (const r of dayRows) {
    channels[r.channel] = {
      production: r.production,
      inflow: r.inflow,
      contactProgress: r.contactProgress,
      contactSuccess: r.contactSuccess,
    };
  }

  const csISO = `${courseStart.getFullYear()}-${String(
    courseStart.getMonth() + 1,
  ).padStart(2, "0")}-${String(courseStart.getDate()).padStart(2, "0")}`;

  return {
    date,
    weekIndex: week,
    courseStart: csISO,
    channels,
    meetings,
  };
}

// ── 일정·계약 탭 (PR 03) ────────────────────────────────────────

export interface ScheduleWeekView {
  weekStart: string; // YYYY-MM-DD (수강시작일과 같은 요일)
  weekIndex: number;
  courseStart: string;
  /** 7개 슬롯 (weekStart=0 ... weekStart+6=6). 미팅날짜 기준. */
  daysByMeetingDate: Array<{ date: string; meetings: Meeting[] }>;
}

/**
 * 한 주의 모든 미팅을 미팅날짜(D열) 기준으로 조회.
 * weekStart는 수강시작일과 같은 요일이어야 함 (검증).
 *
 * 컨택관리 탭은 예약일 기준이지만, 일정·계약 탭은 **미팅날짜 기준** —
 * 그 날 실제로 미팅이 잡혀있는 카드를 보여주기 위함.
 */
export async function loadWeekMeetings(
  email: string,
  weekStart: string,
): Promise<ScheduleWeekView> {
  const spreadsheetId = await resolveSheet(email);
  const courseStart = await readCourseStart(spreadsheetId);
  const wsDate = parseISO(weekStart);
  const week = weekIndexOf(wsDate, courseStart);
  if (week < 1 || week > 10) {
    throw new Error(`[schedule] 편집 가능 기간 외: ${weekStart}`);
  }

  // 7일 ISO 날짜 생성
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(wsDate);
    d.setDate(wsDate.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${dd}`);
  }

  // 한 번의 시트 read로 7일치 미팅 (미팅날짜 기준) — quota 절약
  const map = await findByDateRange(spreadsheetId, dates, "meeting");
  const daysByMeetingDate = dates.map((d) => ({
    date: d,
    meetings: (map.get(d) ?? []).sort((a, b) =>
      a.미팅시간.localeCompare(b.미팅시간),
    ),
  }));

  const csISO = `${courseStart.getFullYear()}-${String(
    courseStart.getMonth() + 1,
  ).padStart(2, "0")}-${String(courseStart.getDate()).padStart(2, "0")}`;

  return {
    weekStart,
    weekIndex: week,
    courseStart: csISO,
    daysByMeetingDate,
  };
}

/**
 * 4지표 4채널을 그 날짜에 update.
 * 검증: 컨택성공 ≤ 컨택진행 (위반 시 자동 보정).
 */
export async function saveContactMetrics(
  email: string,
  date: string,
  channels: Partial<Record<Channel, ChannelDailyRowMetrics>>,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);

  // 4채널을 한 번의 batchUpdate로 저장 (readCourseStart 1회만 호출).
  // 이전: 채널별 writeChannelDailyRow 루프 → readCourseStart 4회 = 4 Read
  // 현재: batchWriteChannelDailyRows → readCourseStart 1회 = 1 Read
  const rows: ChannelDailyRow[] = [];
  for (const channel of CHANNEL_ORDER) {
    const m = channels[channel];
    if (!m) continue;
    const success = Math.min(m.contactSuccess, m.contactProgress);
    rows.push(
      ChannelDailyRow.parse({
        date,
        channel,
        production: m.production,
        inflow: m.inflow,
        contactProgress: m.contactProgress,
        contactSuccess: success,
      }),
    );
  }
  await batchWriteChannelDailyRows(spreadsheetId, rows);
}

/** 새 미팅 1건 등록. 컨택성공 +1은 별도 호출 (saveContactMetrics)에서 처리. */
export async function appendNewMeeting(
  email: string,
  meeting: Meeting,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  const validated = Meeting.parse(meeting);
  await appendMeeting(spreadsheetId, validated);
}

/** 미팅 부분 업데이트 (상태 변경 / 수임비 / 사유 등). */
export async function patchMeeting(
  email: string,
  id: string,
  partial: Partial<Omit<Meeting, "id">>,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  await updateMeeting(spreadsheetId, id, partial);
}

/** 미팅 삭제 (행 클리어). 컨택성공 -1은 호출 측 책임. */
export async function removeMeeting(
  email: string,
  id: string,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  await clearMeeting(spreadsheetId, id);
}

/** id로 미팅 조회. */
export async function getMeetingById(
  email: string,
  id: string,
): Promise<Meeting | null> {
  const spreadsheetId = await resolveSheet(email);
  return findById(spreadsheetId, id);
}
