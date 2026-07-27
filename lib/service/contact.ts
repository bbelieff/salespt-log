/** Layer: service — 컨택탭 유스케이스. 화면은 하루 단위지만 시트는 주차 블록 → 한 주 read 후 그 날 4채널 추출. */
import * as Sentry from "@sentry/nextjs";
import { findUserByEmail } from "@/repo/users";
import { MAX_SHEET_WEEK } from "@/config/cohort-dates";
import { readBanners } from "@/repo/db";
import { readChannelStacking } from "@/repo/dashboard";
import { dbEnabled, readSalesRowsFromDb } from "@/repo/db/client";
import { readBannerOrderQtyFromDb, readMeetingsFromDb } from "@/repo/db/read-daily";
import {
  chooseDailySource,
  dayChannelsFromRows,
  stackingSumsFromRows,
  type DailyMetricRow,
} from "./daily-source";
import { persistMeetingReservationCount, persistSalesRows } from "./sales-write";
import {
  readCourseStart,
  readWeek,
  readWeekFunnel,
  weekIndexOf,
} from "@/repo/sales";
import { findByDate } from "@/repo/meetings";
import {
  clearMeetingRecord,
  createMeetingRecord,
  findChildMeetingRecord,
  findMeetingsByDateRecord,
  getMeetingRecord,
  patchMeetingRecord,
  type MeetingCtx,
} from "./meetings-write";
import {
  clearRowByLink as clearContractPaymentByLink,
  updateLinkFields as updateContractLink,
} from "@/repo/contract-payment";
import {
  hasCompanyInfoArchiveRow,
  renameCompanyInfoKey,
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

async function resolveCtx(email: string): Promise<MeetingCtx> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`[contact] 등록되지 않은 사용자: ${email}`);
  }
  return { spreadsheetId: user.spreadsheetId, cohort: user.cohort, email };
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
  /** 현수막 재고 base = Σ주문장수 − Σ게시누적 + 오늘 저장 게시. UI: max(0, base − draft.게시)(ADR-0025). */
  bannerStockBase: number;
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

/** 한 날짜의 4채널 4지표 + 그 날 미팅 목록 (컨택탭 렌더 입력).
 *
 * R2-1(db-read-contact): 파일럿 기수는 readWeek+readChannelStacking 을 DB 단일 쿼리로.
 * R2-2(db-read-meetings-banners): meetings(04)·현수막 주문합(03)도 DB — 파일럿+캐시 히트 시
 * **시트 read 0회**. 그 외 기수·DB 실패 시엔 기존 시트 경로 그대로
 * (silent fallback + Sentry — 사용자 화면 에러 금지). */
export async function loadDay(
  email: string,
  date: string,
): Promise<ContactDayView> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`[contact] 등록되지 않은 사용자: ${email}`);
  }
  const spreadsheetId = user.spreadsheetId;
  const targetDate = parseISO(date);

  // ── 로드 (게이트: chooseDailySource — 단일 판정 지점) ──
  let courseStart: Date | null = null;
  let metricRows: DailyMetricRow[] | null = null;
  let sums: ReturnType<typeof stackingSumsFromRows> | null = null;
  let meetings: Meeting[] | null = null;
  let bannerOrderQty: number | null = null;

  if (chooseDailySource(user.cohort, dbEnabled()) === "db") {
    try {
      // courseStart: 레지스트리 K 캐시 우선(시트 read 0회 목표), 빈값이면 시트 1회.
      courseStart = user.courseStartISO
        ? parseISO(user.courseStartISO)
        : await readCourseStart(spreadsheetId);
      const [all, allMeetings, orderQty] = await Promise.all([
        readSalesRowsFromDb(spreadsheetId),
        readMeetingsFromDb(spreadsheetId),
        readBannerOrderQtyFromDb(spreadsheetId),
      ]);
      const valid = all.filter((r): r is DailyMetricRow =>
        (CHANNEL_ORDER as readonly string[]).includes(r.channel),
      );
      metricRows = valid;
      sums = stackingSumsFromRows(valid);
      meetings = allMeetings.filter((m) => m.예약일 === date); // findByDate(reservation) 동치
      bannerOrderQty = orderQty;
    } catch (e) {
      Sentry.captureException(e, { tags: { where: "loadDay-db-read" } });
      courseStart = null;
      metricRows = null; // ↓ 아래에서 전부 시트 경로로 silent fallback
      sums = null;
      meetings = null;
      bannerOrderQty = null;
    }
  }

  if (metricRows === null || sums === null) {
    // 기존 시트 경로 (비파일럿 기수 + DB 실패 fallback) — 동작 무변경.
    courseStart = await readCourseStart(spreadsheetId);
    const week0 = weekIndexOf(targetDate, courseStart);
    const inRange0 = week0 >= 1 && week0 <= MAX_SHEET_WEEK;
    const { rows } = inRange0 ? await readWeek(spreadsheetId, week0) : { rows: [] };
    metricRows = rows;
    const stacking = await readChannelStacking(spreadsheetId);
    sums = {
      매입DB생산합: stacking[0]?.[0] ?? 0,
      매입DB유입합: stacking[1]?.[0] ?? 0,
      현수막생산합: stacking[0]?.[2] ?? 0,
    };
  }

  const week = weekIndexOf(targetDate, courseStart!);
  // 편집 가능 기간(1~10주) 밖이면 4지표 빈 값·미팅만 read. 쓰기는 saveContactMetrics 에서 가드.
  const inRange = week >= 1 && week <= MAX_SHEET_WEEK;

  meetings ??= await findByDate(spreadsheetId, date, "reservation"); // 예약일 기준(일정탭=미팅날짜)

  // 4채널 4지표 — 시트/DB 공통 순수 집계(daily-source, 정합 테스트 대상).
  const channels = dayChannelsFromRows(
    inRange ? metricRows : [],
    date,
  ) as Record<Channel, ChannelDailyRowMetrics>;

  // ⭐ 미팅예약 = 업체관리 카드 수 파생(SSOT, ADR-0010) — 경로 무관 보존.
  const cardCount: Record<Channel, number> = {
    매입DB: 0,
    직접생산: 0,
    현수막: 0,
    "콜·지·기·소": 0,
  };
  for (const mtg of meetings) cardCount[mtg.channel] += 1;
  for (const ch of CHANNEL_ORDER) channels[ch].meetingReservation = cardCount[ch];

  const cs = courseStart!;
  const csISO = `${cs.getFullYear()}-${String(cs.getMonth() + 1).padStart(2, "0")}-${String(cs.getDate()).padStart(2, "0")}`;

  // 매입DB 유입대기 base = 생산누적 − 유입누적 + 오늘 저장 유입 — UI 가 draft.유입 실시간 차감.
  const inflowWaitBase = sums.매입DB생산합 - sums.매입DB유입합 + channels.매입DB.inflow;

  // 현수막 재고 base = Σ주문장수(DB탭) − Σ게시누적 + 오늘 저장 게시(ADR-0025).
  bannerOrderQty ??=
    (await readBanners(spreadsheetId)).rows.reduce((s, b) => s + b.주문개수, 0);
  const bannerStockBase = bannerOrderQty - sums.현수막생산합 + channels.현수막.production;

  return {
    date,
    weekIndex: week,
    courseStart: csISO,
    channels,
    meetings,
    inflowWaitBase,
    bannerStockBase,
  };
}

// 일정·계약 탭 주간 뷰 — contact-week.ts 로 분리(500줄 캡, R2-1).
export { loadWeekMeetings, type ScheduleWeekView } from "./contact-week";

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
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contact] 등록되지 않은 사용자: ${email}`);
  const spreadsheetId = user.spreadsheetId;

  // ⭐ 미팅예약(H) = 업체관리 카드 수 파생 (SSOT, ADR-0010). 클라가 보낸 값 무시, 예약일·채널
  //    실제 카드 수로 재계산해 기록 → 저장마다 H=카드수 일치(드리프트 제거).
  //    R3-2: 파일럿은 DB 에서 — 시트 미러 lag 로 방금 등록 카드가 빠지는 과소집계 방지.
  const meetings = await findMeetingsByDateRecord(
    { spreadsheetId, cohort: user.cohort, email },
    date,
    "reservation",
  );
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
    // 콜지기소 생산·유입은 파생(ADR-0029) — 이 값은 저장 안 됨(시트 G:H·DB toDbRows 가 제외).
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
  // 쓰기 정본 저장(R3-1) — 게이트→DB 정본/시트 미러(상세 sales-write.ts). 단일셀 writer는 스코프 밖(R2 유지, 회귀 아님).
  await persistSalesRows(user.cohort, email, spreadsheetId, rows);

  // 직접생산: 유입 저장(E=F 미러 완료) 후 그 날짜 활성 생산 레코드 M 동기화 (ADR-0024).
  // 활성 레코드 없고 유입>0 → 보류(UI 모달). 기록은 이미 됐으니 throw 안 함.
  let directProductionHold = false;
  const direct = channels["직접생산"];
  if (direct) {
    const { recordFound } = await syncDirectProductionForDate(spreadsheetId, date, user.cohort);
    directProductionHold = !recordFound && direct.inflow > 0;
  }
  return { directProductionHold };
}

/** 새 미팅 1건 등록. 미팅예약 +1은 별도 호출 (saveContactMetrics)에서 처리. */
export async function appendNewMeeting(
  email: string,
  meeting: Meeting,
): Promise<void> {
  const ctx = await resolveCtx(email);
  await createMeetingRecord(ctx, Meeting.parse(meeting)); // gcal 등록 포함(경로별 내부 처리)
}

/** 미팅 부분 업데이트. Phase2: 계약→非계약 시 02 clear. Phase3: 계약 유지+link 변경 시 02 sync. */
export async function patchMeeting(
  email: string,
  id: string,
  partial: Partial<Omit<Meeting, "id">>,
): Promise<void> {
  const ctx = await resolveCtx(email);
  const spreadsheetId = ctx.spreadsheetId;
  // 파일럿(결제카드=06 DB read)은 06 쓰기도 DB 동기 정본 — async 미러 실패 시 stale 반쪽쓰기 방지(DevD).
  const syncDb = chooseDailySource(ctx.cohort, dbEnabled()) === "db";
  const droppingContract = partial.상태 !== undefined && partial.상태 !== "계약";
  const linkChange = partial.미팅날짜 !== undefined || partial.업체명 !== undefined;
  if (droppingContract || linkChange) {
    const cur = await getMeetingRecord(ctx, id);
    if (cur?.상태 === "계약" && cur.미팅날짜 && cur.업체명) {
      if (droppingContract) {
        await clearContractPaymentByLink(spreadsheetId, cur.미팅날짜, cur.업체명);
      } else {
        const oldKey = { 계약일: cur.미팅날짜, 업체명: cur.업체명 };
        const next = { 계약일: partial.미팅날짜 ?? cur.미팅날짜, 업체명: partial.업체명 ?? cur.업체명 };
        // id 키로 02 행 특정(개명 안전) + 업체명 개명 시 06 키 이동(실패해도 04 저장은 성공).
        await updateContractLink(spreadsheetId, { ...oldKey, meetingId: id }, next);
        if (partial.업체명 !== undefined && partial.업체명 !== cur.업체명) {
          try { await renameCompanyInfoKey(spreadsheetId, oldKey, next, { syncDb }); }
          catch (e) { console.warn("[contact] 06 키 이동 실패:", e instanceof Error ? e.message : e); }
        }
      }
    }
  }
  const merged = await patchMeetingRecord(ctx, id, partial); // gcal reconcile 포함(경로별 내부)

  // 06 업체정보 동기화(§1-2) — 계약 고객이면 06 같은 키 행 갱신. 실패해도 04 저장은 성공(warn).
  if (partial.업체정보 !== undefined) {
    try {
      const m = merged ?? (await getMeetingRecord(ctx, id)); // 시트 경로만 merge 후 재읽기
      if (m?.미팅날짜 && m.업체명 &&
        (m.상태 === "계약" || (await hasCompanyInfoArchiveRow(spreadsheetId, m.미팅날짜, m.업체명)))) {
        const ci = { 업체명: m.업체명, 계약일: m.미팅날짜, 업체정보: m.업체정보 };
        await upsertCompanyInfoArchive(spreadsheetId, ci, { syncDb });
      }
    } catch (e) {
      if (syncDb) throw e; // 파일럿: 06 DB 동기 실패는 삼키지 않음(조용한 반쪽쓰기 금지, R3 §0)
      console.warn("[contact] 06 업체정보 동기화 실패:", e instanceof Error ? e.message : e);
    }
  }
}

/** 자손 미팅 transitive cascade (post-order). 자식 계약이면 02 row 도 clear. */
async function cascadeDescendantMeetings(
  ctx: MeetingCtx,
  parentId: string,
): Promise<{ count: number; paymentRows: number }> {
  let count = 0;
  let paymentRows = 0;
  async function walk(pid: string): Promise<void> {
    const c = await findChildMeetingRecord(ctx, pid);
    if (!c) return;
    await walk(c.id);
    if (c.상태 === "계약" && c.미팅날짜 && c.업체명) {
      const row = await clearContractPaymentByLink(ctx.spreadsheetId, c.미팅날짜, c.업체명);
      if (row !== null) paymentRows++;
    }
    // 자손 gcal 은 R2 무호출(gcal-2b) 보존 — 파일럿은 수렴 잡 cleared 브랜치가 멱등 제거.
    await clearMeetingRecord(ctx, c.id, { gcalRemove: false });
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
  const ctx = await resolveCtx(email);
  await clearMeetingRecord(ctx, id, { gcalRemove: true }); // 클리어 전 구글 이벤트 삭제 포함
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
  const ctx = await resolveCtx(email);
  const spreadsheetId = ctx.spreadsheetId;
  const m = await getMeetingRecord(ctx, id);
  if (!m) throw new Error(`[removeMeetingWithCascade] 미팅 못 찾음: ${id}`);

  // 1) Descendants 재귀 삭제.
  const { count: descCount, paymentRows: descPaymentRows } =
    await cascadeDescendantMeetings(ctx, id);
  // 2) 본인이 계약이면 02 row cascade.
  let removedPaymentRow: number | null = null;
  if (m.상태 === "계약" && m.미팅날짜 && m.업체명) {
    removedPaymentRow = await clearContractPaymentByLink(spreadsheetId, m.미팅날짜, m.업체명);
  }
  // 3) 본인 clear(클리어 전 구글 이벤트 삭제 포함) + 4) 영업관리 H -1 (좌표 실패 시 skip).
  await clearMeetingRecord(ctx, id, { gcalRemove: true });
  if (m.예약일 && m.channel) {
    // R3⑤: 파일럿은 DB 정본에 **카드수 절대 재계산**(±1 RMW 폐기, ADR-0010) + 시트 수렴 미러.
    try { await persistMeetingReservationCount(ctx, m.예약일, m.channel); } catch { /* skip */ }
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
  const ctx = await resolveCtx(email);
  const spreadsheetId = ctx.spreadsheetId;
  const m = await getMeetingRecord(ctx, id);
  if (!m) throw new Error(`[revert] 미팅 못 찾음: ${id}`);
  const prevState = m.상태;

  if (prevState === "계약") {
    await patchMeetingRecord(ctx, id, {
      상태: "예약",
      계약여부: false,
      수임비: 0,
      계약조건: "",
    }); // gcal 갱신 포함
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
    await patchMeetingRecord(ctx, id, {
      상태: "예약",
      계약여부: false,
      미팅사유: "",
    }); // 취소/완료→예약 → gcal 재등록/갱신 포함
    return { status: "예약", cascade: "사유 초기화" };
  }

  if (prevState === "변경") {
    // 2026-05-19: 손자까지 transitive cascade (1→2→3 체인 전부 삭제).
    const { count } = await cascadeDescendantMeetings(ctx, id);
    await patchMeetingRecord(ctx, id, { 상태: "예약", 미팅사유: "" }); // gcal 갱신 포함
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
  const ctx = await resolveCtx(email);
  const child = await findChildMeetingRecord(ctx, parentId);
  if (!child) {
    return { cascade: "자식 미팅 없음 — 되살릴 항목 없음", childId: null };
  }
  // 2026-05-19: 자식의 자손까지 transitive cascade.
  const { count: descCount } = await cascadeDescendantMeetings(ctx, child.id);
  let cascade02 = "";
  if (child.상태 === "계약" && child.미팅날짜 && child.업체명) {
    const row = await clearContractPaymentByLink(ctx.spreadsheetId, child.미팅날짜, child.업체명);
    if (row !== null) cascade02 = ` + 02 row ${row}`;
  }
  await clearMeetingRecord(ctx, child.id, { gcalRemove: true }); // 이벤트 삭제(클리어 전) 포함
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
  const ctx = await resolveCtx(email);
  return getMeetingRecord(ctx, id);
}
