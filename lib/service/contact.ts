/** Layer: service — 컨택탭 유스케이스. 화면은 하루 단위지만 시트는 주차 블록 → 한 주 read 후 그 날 4채널 추출. */
import { findUserByEmail } from "@/repo/users";
import { readChannelStacking } from "@/repo/dashboard";
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
  findByDateRangeBoth,
  findById,
  findByPreviousMeetingId,
  updateMeeting,
} from "@/repo/meetings";
import {
  clearRowByLink as clearContractPaymentByLink,
  updateLinkFields as updateContractLink,
} from "@/repo/contract-payment";
import {
  hasCompanyInfoArchiveRow,
  upsertCompanyInfoArchive,
} from "@/repo/company-info-archive";
import { syncDirectProductionForDate } from "./db";
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
  /** 매입DB 유입대기 base = 생산누적 − 유입누적 + 오늘 저장 유입(R1:U6). UI: max(0, base − draft.유입). */
  inflowWaitBase: number;
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

/** 한 날짜의 4채널 4지표 + 그 날 미팅 목록 (컨택탭 렌더 입력). */
export async function loadDay(
  email: string,
  date: string,
): Promise<ContactDayView> {
  const spreadsheetId = await resolveSheet(email);
  const courseStart = await readCourseStart(spreadsheetId);
  const targetDate = parseISO(date);
  const week = weekIndexOf(targetDate, courseStart);
  // 편집 가능 기간(1~10주) 밖이면 4지표 빈 값·미팅만 read. 쓰기는 saveContactMetrics 에서 가드.
  const inRange = week >= 1 && week <= 10;

  const { rows } = inRange ? await readWeek(spreadsheetId, week) : { rows: [] };
  // ⭐ 컨택탭은 예약일(컨택한 날) 기준 조회 — 미팅날짜 기준은 일정·계약 탭 몫 (sheet-structure §2).
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
      meetingReservation: r.meetingReservation, // 아래에서 카드수로 덮어씀
    };
  }
  // ⭐ 미팅예약 = 업체관리 카드 수 파생(SSOT, ADR-0010). H↔카드 드리프트를 read 시점에 교정.
  const cardCount: Record<Channel, number> = {
    매입DB: 0,
    직접생산: 0,
    현수막: 0,
    "콜·지·기·소": 0,
  };
  for (const mtg of meetings) cardCount[mtg.channel] += 1;
  for (const ch of CHANNEL_ORDER) channels[ch].meetingReservation = cardCount[ch];

  const csISO = `${courseStart.getFullYear()}-${String(
    courseStart.getMonth() + 1,
  ).padStart(2, "0")}-${String(courseStart.getDate()).padStart(2, "0")}`;

  // 매입DB 유입대기 base = 생산누적(R1) − 유입누적(R2) + 오늘 저장 유입 — UI 가 draft.유입 으로 실시간 차감.
  const stacking = await readChannelStacking(spreadsheetId);
  const inflowWaitBase =
    (stacking[0]?.[0] ?? 0) - (stacking[1]?.[0] ?? 0) + channels.매입DB.inflow;

  return {
    date,
    weekIndex: week,
    courseStart: csISO,
    channels,
    meetings,
    inflowWaitBase,
  };
}

// ── 일정·계약 탭 (PR 03) ────────────────────────────────────────

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
 * 4지표 4채널을 그 날짜에 update. 미팅예약(H)=카드수 재계산.
 * 직접생산: 생산(E)=유입 미러 + 활성 생산 레코드 M 동기화 (ADR-0024).
 * @returns directProductionHold — 직접생산 유입>0 인데 활성 생산 기간 없음(보류 모달).
 */
export async function saveContactMetrics(
  email: string,
  date: string,
  channels: Partial<Record<Channel, ChannelDailyRowMetrics>>,
): Promise<{ directProductionHold: boolean }> {
  const spreadsheetId = await resolveSheet(email);

  // ⭐ 미팅예약(H) = 업체관리 카드 수 파생 (SSOT, ADR-0010). 클라가 보낸 값 무시, 예약일·채널
  //    실제 카드 수로 재계산해 기록 → 저장마다 H=카드수 일치(드리프트 제거).
  const meetings = await findByDate(spreadsheetId, date, "reservation");
  const cardCount: Record<Channel, number> = {
    매입DB: 0,
    직접생산: 0,
    현수막: 0,
    "콜·지·기·소": 0,
  };
  for (const mtg of meetings) cardCount[mtg.channel] += 1;

  // 4채널 1회 batchUpdate (readCourseStart 1회).
  const rows: ChannelDailyRow[] = [];
  for (const channel of CHANNEL_ORDER) {
    const m = channels[channel];
    if (!m) continue;
    rows.push(
      ChannelDailyRow.parse({
        date,
        channel,
        production: m.production,
        inflow: m.inflow,
        contactProgress: m.contactProgress,
        meetingReservation: cardCount[channel], // 카드 수 = 진실
      }),
    );
  }
  await batchWriteChannelDailyRows(spreadsheetId, rows);

  // 직접생산: 유입 저장(E=F 미러 완료) 후 그 날짜 활성 생산 레코드 M 동기화 (ADR-0024).
  // 활성 레코드 없고 유입>0 → 보류(UI 모달). 기록은 이미 됐으니 throw 안 함.
  let directProductionHold = false;
  const direct = channels["직접생산"];
  if (direct) {
    const { recordFound } = await syncDirectProductionForDate(spreadsheetId, date);
    directProductionHold = !recordFound && direct.inflow > 0;
  }
  return { directProductionHold };
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

/** 미팅 부분 업데이트. Phase2: 계약→非계약 시 02 clear. Phase3: 계약 유지+link 변경 시 02 sync. */
export async function patchMeeting(
  email: string,
  id: string,
  partial: Partial<Omit<Meeting, "id">>,
): Promise<void> {
  const spreadsheetId = await resolveSheet(email);
  const droppingContract = partial.상태 !== undefined && partial.상태 !== "계약";
  const linkChange = partial.미팅날짜 !== undefined || partial.업체명 !== undefined;
  if (droppingContract || linkChange) {
    const cur = await findById(spreadsheetId, id);
    if (cur?.상태 === "계약" && cur.미팅날짜 && cur.업체명) {
      if (droppingContract) {
        await clearContractPaymentByLink(spreadsheetId, cur.미팅날짜, cur.업체명);
      } else {
        await updateContractLink(
          spreadsheetId,
          { 계약일: cur.미팅날짜, 업체명: cur.업체명 },
          { 계약일: partial.미팅날짜 ?? cur.미팅날짜, 업체명: partial.업체명 ?? cur.업체명 },
        );
      }
    }
  }
  await updateMeeting(spreadsheetId, id, partial);

  // 06 업체정보 동기화(§1-2) — 계약 고객이면 06 같은 키 행 갱신. 실패해도 04 저장은 성공(warn).
  if (partial.업체정보 !== undefined) {
    try {
      const m = await findById(spreadsheetId, id); // merge 후 재읽기 — 최신 업체정보
      if (m?.미팅날짜 && m.업체명) {
        if (
          m.상태 === "계약" ||
          (await hasCompanyInfoArchiveRow(spreadsheetId, m.미팅날짜, m.업체명))
        ) {
          await upsertCompanyInfoArchive(spreadsheetId, {
            업체명: m.업체명,
            계약일: m.미팅날짜,
            업체정보: m.업체정보,
          });
        }
      }
    } catch (e) {
      console.warn(
        "[contact] 06 업체정보 동기화 실패 (04 저장은 성공):",
        e instanceof Error ? e.message : e,
      );
    }
  }
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
 * 미팅 결과 되돌리기 (2026-05-17 [2a]). 계약→예약: 02 row clear.
 * 완료/취소→예약: 사유 초기화. 변경→예약: 자손 미팅 cascade 삭제.
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
