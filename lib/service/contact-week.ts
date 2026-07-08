/** Layer: service — 일정·계약 탭 주간 뷰 (contact.ts 에서 분리 — 500줄 캡, R2-1). */
import { findUserByEmail } from "@/repo/users";
import { readCourseStart, readWeekFunnel, weekIndexOf } from "@/repo/sales";
import { findByDateRangeBoth } from "@/repo/meetings";
import { Meeting } from "@/types";

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

async function resolveSheet(email: string): Promise<string> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contact-week] 등록되지 않은 사용자: ${email}`);
  return user.spreadsheetId;
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
  const spreadsheetId = await resolveSheet(email);
  const courseStart = await readCourseStart(spreadsheetId);
  const wsDate = parseISO(weekStart);
  // 편집 가능 기간 가드는 쓰기 시점(saveContactMetrics/appendNewMeeting)에만 적용.
  // 조회는 항상 가능 — findByDateRange는 week 인덱스에 의존하지 않아 안전.
  // weekIndex는 표시용이므로 음수/10 초과도 그대로 노출.
  const week = weekIndexOf(wsDate, courseStart);

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

  // 1 read 로 예약일/미팅날짜 두 view 동시 추출 (2026-05-16 view 불일치 fix).
  const [{ byMeetingDate, byReservationDate }, weekFunnel] = await Promise.all([
    findByDateRangeBoth(spreadsheetId, dates),
    readWeekFunnel(spreadsheetId, week),
  ]);
  const sortByTime = (a: Meeting, b: Meeting) =>
    a.미팅시간.localeCompare(b.미팅시간);
  const daysByMeetingDate = dates.map((d) => ({
    date: d,
    meetings: (byMeetingDate.get(d) ?? []).sort(sortByTime),
  }));
  const daysByReservationDate = dates.map((d) => ({
    date: d,
    meetings: (byReservationDate.get(d) ?? []).sort(sortByTime),
  }));

  const csISO = `${courseStart.getFullYear()}-${String(courseStart.getMonth() + 1).padStart(2, "0")}-${String(courseStart.getDate()).padStart(2, "0")}`;

  return {
    weekStart,
    weekIndex: week,
    courseStart: csISO,
    daysByMeetingDate,
    daysByReservationDate,
    weekFunnel,
  };
}
