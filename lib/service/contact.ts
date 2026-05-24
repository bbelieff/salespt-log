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
  decrementMeetingReservation,
  readCourseStart,
  readWeek,
  readWeekFunnel,
  weekIndexOf,
} from "@/repo/sales";
import {
  appendMeeting,
  clearMeeting,
  findByDate,
  findByDateRange,
  findByDateRangeBoth,
  findById,
  findByPreviousMeetingId,
  updateMeeting,
} from "@/repo/meetings";
import { clearRowByLink as clearContractPaymentByLink } from "@/repo/contract-payment";
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
  meetingReservation: number;
}

const EMPTY_METRICS: ChannelDailyRowMetrics = {
  production: 0,
  inflow: 0,
  contactProgress: 0,
  meetingReservation: 0,
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
  // 편집 가능 기간(1~10주) 밖이면 4지표는 빈 값으로, 미팅만 read.
  // 조회는 항상 가능, 쓰기는 saveContactMetrics 단계에서 가드.
  const inRange = week >= 1 && week <= 10;

  const { rows } = inRange
    ? await readWeek(spreadsheetId, week)
    : { rows: [] };
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
      meetingReservation: r.meetingReservation,
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

// ── 캘린더 탭 (PR 03 / Phase 4) ─────────────────────────────────

export interface CalendarMonthView {
  yyyyMM: string; // "2026-04"
  /** 월의 모든 날짜 (YYYY-MM-DD) → 그 날 미팅 (미팅날짜 기준). */
  daysByMeetingDate: Array<{ date: string; meetings: Meeting[] }>;
}

/**
 * 한 달의 모든 미팅을 미팅날짜 기준으로 조회.
 * yyyyMM은 "YYYY-MM" 형식. 1번의 시트 read로 31일치 조회.
 */
export async function loadMonthMeetings(
  email: string,
  yyyyMM: string,
): Promise<CalendarMonthView> {
  const m = yyyyMM.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error(`[calendar] yyyyMM 포맷 오류: ${yyyyMM}`);
  const year = Number(m[1]);
  const month = Number(m[2]); // 1~12
  const spreadsheetId = await resolveSheet(email);

  // 그 달의 모든 날짜 생성 (1일 ~ 마지막날)
  const lastDay = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dd = String(d).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    dates.push(`${year}-${mm}-${dd}`);
  }

  const map = await findByDateRange(spreadsheetId, dates, "meeting");
  const daysByMeetingDate = dates.map((d) => ({
    date: d,
    meetings: (map.get(d) ?? []).sort((a, b) =>
      a.미팅시간.localeCompare(b.미팅시간),
    ),
  }));

  return { yyyyMM, daysByMeetingDate };
}

// ── 일정·계약 탭 (PR 03) ────────────────────────────────────────

export interface ScheduleWeekView {
  weekStart: string; // YYYY-MM-DD (수강시작일과 같은 요일)
  weekIndex: number;
  courseStart: string;
  /** 7개 슬롯, **미팅날짜** 기준 — 일정·계약 탭 cards (그 날 실제 미팅 있는 카드). */
  daysByMeetingDate: Array<{ date: string; meetings: Meeting[] }>;
  /** 7개 슬롯, **예약일** 기준 — 컨택탭 badge + 일자 cards (2026-05-16 추가).
   *  컨택탭 day view 가 `예약일=date` 필터인데 badge 가 미팅날짜 기준이라
   *  불일치 사고 (사용자 보고 5/14 badge 1 인데 카드 없음) → 두 기준 분리. */
  daysByReservationDate: Array<{ date: string; meetings: Meeting[] }>;
  /** 영업관리 E~H 의 그 주 합계 — 생산/유입/컨택진행/미팅예약.
   *  컨택탭 헤더 funnel 표시용 (2026-05-16). 일정·계약 탭은 안 씀. */
  weekFunnel: {
    생산: number;
    유입: number;
    컨택진행: number;
    미팅예약: number;
  };
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

  // 1 sheet read 에서 두 기준 (예약일/미팅날짜) 동시 추출 + 영업관리 E~H 주 합계.
  // **2026-05-16**: `findByDateRangeBoth` 로 컨택탭 badge(예약일) + 일정·계약 탭
  // cards(미팅날짜) 의 두 view 를 한 read 로 — 사용자 보고 [3] (5/14 badge=1
  // 인데 카드 없음) 의 view 불일치 사고 fix.
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

  const csISO = `${courseStart.getFullYear()}-${String(
    courseStart.getMonth() + 1,
  ).padStart(2, "0")}-${String(courseStart.getDate()).padStart(2, "0")}`;

  return {
    weekStart,
    weekIndex: week,
    courseStart: csISO,
    daysByMeetingDate,
    daysByReservationDate,
    weekFunnel,
  };
}

/**
 * 4지표 4채널을 그 날짜에 update.
 * 검증: 미팅예약 ≤ 컨택진행 (위반 시 자동 보정).
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
    const success = Math.min(m.meetingReservation, m.contactProgress);
    rows.push(
      ChannelDailyRow.parse({
        date,
        channel,
        production: m.production,
        inflow: m.inflow,
        contactProgress: m.contactProgress,
        meetingReservation: success,
      }),
    );
  }
  await batchWriteChannelDailyRows(spreadsheetId, rows);
}

/** 새 미팅 1건 등록. 미팅예약 +1은 별도 호출 (saveContactMetrics)에서 처리. */
export async function appendNewMeeting(
  email: string,
  meeting: Meeting,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  const validated = Meeting.parse(meeting);
  await appendMeeting(spreadsheetId, validated);
}

/** 미팅 부분 업데이트. Phase 2: 계약→非계약 전환 시 02 계약카드 cascade clear. */
export async function patchMeeting(
  email: string,
  id: string,
  partial: Partial<Omit<Meeting, "id">>,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  // 상태 전이 감지: 계약 → 非계약 이면 계약카드 cascade.
  if (partial.상태 && partial.상태 !== "계약") {
    const cur = await findById(spreadsheetId, id);
    if (cur?.상태 === "계약" && cur.미팅날짜 && cur.업체명) {
      await clearContractPaymentByLink(spreadsheetId, cur.미팅날짜, cur.업체명);
    }
  }
  await updateMeeting(spreadsheetId, id, partial);
}

/** 자손 미팅 transitive cascade (post-order). 자식 계약이면 02 row 도 clear. */
async function cascadeDescendantMeetings(
  spreadsheetId: string,
  parentId: string,
): Promise<{ count: number; paymentRows: number }> {
  let count = 0;
  let paymentRows = 0;
  async function walk(pid: string): Promise<void> {
    const c = await findByPreviousMeetingId(spreadsheetId, pid);
    if (!c) return;
    await walk(c.id);
    if (c.상태 === "계약" && c.미팅날짜 && c.업체명) {
      const row = await clearContractPaymentByLink(spreadsheetId, c.미팅날짜, c.업체명);
      if (row !== null) paymentRows++;
    }
    await clearMeeting(spreadsheetId, c.id);
    count++;
  }
  await walk(parentId);
  return { count, paymentRows };
}

/** 미팅 삭제 (행 클리어). 미팅예약 -1은 호출 측 책임. cascade 없음. */
export async function removeMeeting(
  email: string,
  id: string,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  await clearMeeting(spreadsheetId, id);
}

/** 미팅 + 자손 transitive cascade + 본인 계약 02 row cascade. L1 -1은 호출 측. */
export async function removeMeetingWithCascade(
  email: string,
  id: string,
): Promise<{
  cascade: string;
  removedPaymentRow: number | null;
  removedDescendantCount: number;
  업체명: string;
  미팅날짜: string;
  상태: string;
}> {
  const spreadsheetId = await resolveSheet(email);
  const m = await findById(spreadsheetId, id);
  if (!m) throw new Error(`[removeMeetingWithCascade] 미팅 못 찾음: ${id}`);

  // 1) Descendants 재귀 삭제.
  const { count: descCount, paymentRows: descPaymentRows } =
    await cascadeDescendantMeetings(spreadsheetId, id);
  // 2) 본인이 계약이면 02 row cascade.
  let removedPaymentRow: number | null = null;
  if (m.상태 === "계약" && m.미팅날짜 && m.업체명) {
    removedPaymentRow = await clearContractPaymentByLink(spreadsheetId, m.미팅날짜, m.업체명);
  }
  // 3) 본인 clear + 4) 영업관리 H -1 (좌표 실패 시 skip).
  await clearMeeting(spreadsheetId, id);
  if (m.예약일 && m.channel) {
    try { await decrementMeetingReservation(spreadsheetId, m.예약일, m.channel); } catch { /* skip */ }
  }
  const parts: string[] = ["영업관리 H -1"];
  if (descCount > 0) parts.push(`자손 미팅 ${descCount}건 cascade`);
  if (descPaymentRows > 0) parts.push(`자손 계약 ${descPaymentRows}건`);
  if (removedPaymentRow !== null) parts.push(`본인 계약카드 삭제`);

  return {
    cascade: parts.join(", "),
    removedPaymentRow,
    removedDescendantCount: descCount,
    업체명: m.업체명,
    미팅날짜: m.미팅날짜,
    상태: m.상태,
  };
}

/**
 * 미팅 결과 되돌리기 (2026-05-17 [2a]).
 *
 * 상태별 cascade:
 *  - 계약 → 예약: 수임비/계약조건/계약여부 초기화 + 02 계약수납관리 매칭 row clear
 *  - 완료/취소 → 예약: 미팅사유 초기화
 *  - 변경 → 예약: 변경으로 생긴 자식 미팅(previousMeetingId=original.id) 삭제 + 원본 예약 복원
 *
 * 반환: 어떤 cascade 가 일어났는지 요약 (UI 토스트용).
 */
export async function revertMeeting(
  email: string,
  id: string,
): Promise<{ status: string; cascade: string }> {
  const spreadsheetId = await resolveSheet(email);
  const m = await findById(spreadsheetId, id);
  if (!m) throw new Error(`[revert] 미팅 못 찾음: ${id}`);
  const prevState = m.상태;

  if (prevState === "계약") {
    await updateMeeting(spreadsheetId, id, {
      상태: "예약",
      계약여부: false,
      수임비: 0,
      계약조건: "",
    });
    const clearedRow = await clearContractPaymentByLink(
      spreadsheetId,
      m.미팅날짜,
      m.업체명,
    );
    return {
      status: "예약",
      cascade:
        clearedRow !== null
          ? `02 계약수납관리 row ${clearedRow} clear`
          : "02 계약수납관리 매칭 row 없음 (이미 정리됨)",
    };
  }

  if (prevState === "완료" || prevState === "취소") {
    await updateMeeting(spreadsheetId, id, {
      상태: "예약",
      계약여부: false,
      미팅사유: "",
    });
    return { status: "예약", cascade: "사유 초기화" };
  }

  if (prevState === "변경") {
    // 2026-05-19: 손자까지 transitive cascade (1→2→3 체인 전부 삭제).
    const { count } = await cascadeDescendantMeetings(spreadsheetId, id);
    await updateMeeting(spreadsheetId, id, { 상태: "예약", 미팅사유: "" });
    return {
      status: "예약",
      cascade: count > 0 ? `변경 자손 미팅 ${count}건 cascade 삭제` : "변경 자식 미팅 없음",
    };
  }

  // 이미 예약이거나 알 수 없는 상태 → 노옵
  return { status: prevState, cascade: "되돌릴 항목 없음" };
}

/**
 * 케이스 종료 되살리기 (2026-05-19).
 *
 * 완료/취소/계약 카드의 자식 추가미팅(previousMeetingId 매칭) 을 삭제하여
 * 케이스를 다시 진행 가능 상태로 복원. 부모 상태는 유지.
 * 자식이 계약 상태면 02 계약수납관리 row 도 cascade clear.
 */
export async function reviveCaseClosure(
  email: string,
  parentId: string,
): Promise<{ cascade: string; childId: string | null }> {
  const spreadsheetId = await resolveSheet(email);
  const child = await findByPreviousMeetingId(spreadsheetId, parentId);
  if (!child) {
    return { cascade: "자식 미팅 없음 — 되살릴 항목 없음", childId: null };
  }
  // 2026-05-19: 자식의 자손까지 transitive cascade.
  const { count: descCount } = await cascadeDescendantMeetings(
    spreadsheetId,
    child.id,
  );
  let cascade02 = "";
  if (child.상태 === "계약" && child.미팅날짜 && child.업체명) {
    const row = await clearContractPaymentByLink(spreadsheetId, child.미팅날짜, child.업체명);
    if (row !== null) cascade02 = ` + 02 row ${row}`;
  }
  await clearMeeting(spreadsheetId, child.id);
  const descMsg = descCount > 0 ? ` (자손 ${descCount}건 포함)` : "";
  return {
    cascade: `자식 미팅(${child.업체명}) 삭제${descMsg}${cascade02}`,
    childId: child.id,
  };
}

/** id로 미팅 조회. */
export async function getMeetingById(
  email: string,
  id: string,
): Promise<Meeting | null> {
  const spreadsheetId = await resolveSheet(email);
  return findById(spreadsheetId, id);
}
