/** Layer: service — 일정·계약 탭 주간 뷰 (contact.ts 에서 분리 — 500줄 캡, R2-1).
 *
 * R2-3(db-read-schedule): 파일럿 기수는 미팅(04 미러)+주간 funnel(sales 미러)을 DB 로 —
 * 캐시 히트 시 시트 read 0회. 실패 시 전체 시트 silent fallback + Sentry(화면 에러 금지).
 * 계약(02) 읽기는 이 파일 범위 밖(R2-4). 표시문자열 2종(N·O)은 Meeting payload 에 실려
 * 오는 값 그대로(dual-write=옵셔널 필드, backfill=열문자) — 별도 파생 없음(기존과 동일). */
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail } from "@/repo/users";
import { readCourseStart, readWeekFunnel, weekIndexOf } from "@/repo/sales";
import { MAX_SHEET_WEEK } from "@/config/cohort-dates";
import { findByDateRangeBoth } from "@/repo/meetings";
import { dbEnabled, readSalesRowsFromDb } from "@/repo/db/client";
import { readMeetingsFromDb } from "@/repo/db/read-daily";
import {
  chooseDailySource,
  weekFunnelFromRows,
  type DailyMetricRow,
} from "./daily-source";
import { CHANNEL_ORDER, Meeting } from "@/types";

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 기준일부터 7일 ISO 배열. */
function sevenDays(from: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    out.push(toISO(d));
  }
  return out;
}

/** findByDateRangeBoth 의 DB 동치 — 전체 미팅을 두 날짜 기준으로 dates 슬롯에 배분. (R2-3)
 * 시트 경로와 같은 의미: 예약일/미팅날짜가 dates 에 있는 카드만, id 중복 없음(row_key 유일). */
export function groupMeetingsBoth(
  all: Meeting[],
  dates: readonly string[],
): {
  byMeetingDate: Map<string, Meeting[]>;
  byReservationDate: Map<string, Meeting[]>;
} {
  const byMeetingDate = new Map<string, Meeting[]>();
  const byReservationDate = new Map<string, Meeting[]>();
  for (const d of dates) {
    byMeetingDate.set(d, []);
    byReservationDate.set(d, []);
  }
  for (const m of all) {
    byMeetingDate.get(m.미팅날짜)?.push(m);
    byReservationDate.get(m.예약일)?.push(m);
  }
  return { byMeetingDate, byReservationDate };
}

export interface ScheduleWeekView {
  weekStart: string; // YYYY-MM-DD (수강시작일과 같은 요일)
  weekIndex: number;
  courseStart: string;
  /** 7개 슬롯, **미팅날짜** 기준 — 일정·계약 탭 cards (그 날 실제 미팅 있는 카드). */
  daysByMeetingDate: Array<{ date: string; meetings: Meeting[] }>;
  /** 7개 슬롯, **예약일** 기준 — 컨택탭 badge + 일자 cards. 미팅날짜/예약일 기준 분리(2026-05-16). */
  daysByReservationDate: Array<{ date: string; meetings: Meeting[] }>;
  /** 영업관리 E~H 그 주 합계 — 컨택탭 헤더 funnel 표시용(2026-05-16). */
  weekFunnel: {
    생산: number;
    유입: number;
    컨택진행: number;
    미팅예약: number;
  };
}

/** 한 주의 미팅을 미팅날짜(D열) 기준으로 조회 (일정·계약 탭 — 그 날 실제 잡힌 카드). */
export async function loadWeekMeetings(
  email: string,
  weekStart: string,
): Promise<ScheduleWeekView> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contact-week] 등록되지 않은 사용자: ${email}`);
  if (!user.spreadsheetId) {
    // 빈 spreadsheetId 로 시트 read → 구글 HTML 에러 500 (P1, 2026-07-28). route 가 404 매핑.
    throw new Error(`[no-sheet] 개인 시트가 없는 계정: ${email}`);
  }
  const spreadsheetId = user.spreadsheetId;
  const wsDate = parseISO(weekStart);

  // 편집 가능 기간 가드는 쓰기 시점(saveContactMetrics/appendNewMeeting)에만 적용.
  // 조회는 항상 가능 — weekIndex 는 표시용이므로 음수/10 초과도 그대로 노출.
  let courseStart: Date | null = null;
  let both: ReturnType<typeof groupMeetingsBoth> | null = null;
  let weekFunnel: ScheduleWeekView["weekFunnel"] | null = null;

  // 7일 ISO 날짜 생성 (양 경로 공용 — 카드 슬롯 기준)
  const dates = sevenDays(wsDate);

  const pilotDb = chooseDailySource(user.cohort, dbEnabled()) === "db";

  if (pilotDb) {
    try {
      courseStart = user.courseStartISO
        ? parseISO(user.courseStartISO)
        : await readCourseStart(spreadsheetId);
      const week = weekIndexOf(wsDate, courseStart);
      const [allMeetings, salesRows] = await Promise.all([
        readMeetingsFromDb(spreadsheetId),
        readSalesRowsFromDb(spreadsheetId),
      ]);
      both = groupMeetingsBoth(allMeetings, dates);
      // funnel — 주 블록(수강시작 기준 7일) 합.
      // R4 W1-1: DB 정본은 **상한을 걸지 않는다**(11주+ 도 정본 보유 — 화면이 0 이면 저장분이
      // 사라진 것처럼 보이고 재저장이 정본을 덮는다). 하한(주차 0=수강 시작 전)만 0 처리 —
      // 그 주 블록은 애초에 존재하지 않는다. 시트 폴백 경로(아래)는 기존 1~MAX_SHEET_WEEK 유지.
      if (week >= 1) {
        const blockDates = sevenDays(
          (() => { const d = new Date(courseStart); d.setDate(d.getDate() + (week - 1) * 7); return d; })(),
        );
        const valid = salesRows.filter((r): r is DailyMetricRow =>
          (CHANNEL_ORDER as readonly string[]).includes(r.channel),
        );
        weekFunnel = weekFunnelFromRows(valid, blockDates);
      } else {
        weekFunnel = { 생산: 0, 유입: 0, 컨택진행: 0, 미팅예약: 0 };
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { where: "loadWeekMeetings-db-read" } });
      courseStart = null;
      both = null; // ↓ 전부 시트 경로로 silent fallback
      weekFunnel = null;
    }
  }

  if (both === null || weekFunnel === null) {
    // 기존 시트 경로 (비파일럿 기수 + DB 실패 fallback) — 동작 무변경.
    courseStart = await readCourseStart(spreadsheetId);
    const week = weekIndexOf(wsDate, courseStart);
    // 1 read 로 예약일/미팅날짜 두 view 동시 추출 (2026-05-16 view 불일치 fix).
    const [sheetBoth, sheetFunnel] = await Promise.all([
      findByDateRangeBoth(spreadsheetId, dates),
      readWeekFunnel(spreadsheetId, week),
    ]);
    both = sheetBoth;
    weekFunnel = sheetFunnel;

    // 🔧 P0(BBE-49): 비파일럿 11주+ 는 시트에 그 주 블록이 없어 readWeekFunnel 이 **항상 0** 이다
    // (lib/repo/sales.ts 의 week 범위 가드). loadDay·persistSalesRows 는 그 구간을 DB 로 우회하므로,
    // 여기만 0 이면 "날짜칸엔 보이는데 바로 위 주간 퍼널은 0" 이라는 같은 화면 안 불일치가 남는다.
    // 미팅 카드(both)는 비파일럿이면 시트가 정본이라 그대로 두고, 퍼널만 DB 로 재계산한다.
    if (!pilotDb && dbEnabled() && week > MAX_SHEET_WEEK) {
      try {
        const salesRows = await readSalesRowsFromDb(spreadsheetId);
        const valid = salesRows.filter((r): r is DailyMetricRow =>
          (CHANNEL_ORDER as readonly string[]).includes(r.channel),
        );
        const blockStart = new Date(courseStart);
        blockStart.setDate(blockStart.getDate() + (week - 1) * 7);
        weekFunnel = weekFunnelFromRows(valid, sevenDays(blockStart));
      } catch (e) {
        // 실패해도 시트 퍼널(0)로 남는다 — 화면 에러 금지(기존 silent fallback 정책).
        Sentry.captureException(e, { tags: { where: "loadWeekMeetings-nonpilot-week11-funnel" } });
      }
    }
  }

  const week = weekIndexOf(wsDate, courseStart!);
  const sortByTime = (a: Meeting, b: Meeting) =>
    a.미팅시간.localeCompare(b.미팅시간);
  const daysByMeetingDate = dates.map((d) => ({
    date: d,
    meetings: (both!.byMeetingDate.get(d) ?? []).sort(sortByTime),
  }));
  const daysByReservationDate = dates.map((d) => ({
    date: d,
    meetings: (both!.byReservationDate.get(d) ?? []).sort(sortByTime),
  }));

  return {
    weekStart,
    weekIndex: week,
    courseStart: toISO(courseStart!),
    daysByMeetingDate,
    daysByReservationDate,
    weekFunnel,
  };
}
