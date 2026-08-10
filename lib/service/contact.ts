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

export async function resolveCtx(email: string): Promise<MeetingCtx> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`[contact] 등록되지 않은 사용자: ${email}`);
  // [no-sheet]: 빈 sheetId 시트 read → 구글 HTML 500 (P1 2026-07-28) — route 가 404 매핑
  if (!user.spreadsheetId) throw new Error(`[no-sheet] 개인 시트가 없는 계정: ${email}`);
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
  if (!user.spreadsheetId) throw new Error(`[no-sheet] 개인 시트가 없는 계정: ${email}`);
  const spreadsheetId = user.spreadsheetId;
  const targetDate = parseISO(date);

  // ── 로드 (게이트: chooseDailySource — 단일 판정 지점) ──
  let courseStart: Date | null = null;
  let metricRows: DailyMetricRow[] | null = null;
  let sums: ReturnType<typeof stackingSumsFromRows> | null = null;
  let meetings: Meeting[] | null = null;
  let bannerOrderQty: number | null = null;
  let dbCanonicalRead = false; // R4 W1-1: DB 정본 read 성공 → 주차상한 지우기 해제(안 그러면 11주+ 화면 0 → draft 0 시드 → 다음 저장이 정본을 덮음)

  const pilotDb = chooseDailySource(user.cohort, dbEnabled()) === "db";

  // 🔧 P0(BBE-49): 비파일럿(예: 7기)이라도 이 날짜가 시트 물리 상한(MAX_SHEET_WEEK)을 넘으면
  // 그 날 4지표만 DB 에서 읽는다 — persistSalesRows 의 쓰기측 우회(같은 BBE-49)와 대칭.
  // 안 맞추면 "저장은 DB에 됐는데 조회 화면은 계속 0" 이라는 read/write 비대칭이 재발한다
  // (비용원장 사고와 동일 클래스, §0 정본 이원화 금지 위반).
  // ⚠️ 판정 원천은 **시트 O1**이다 — 쓰기측(sales-write.isBeyondSheetPhysicalLimit)이 O1 을 쓰므로
  // 여기서 레지스트리 K 캐시를 쓰면 두 게이트가 10/11주 경계에서 갈려 비대칭이 되살아난다.
  // (K 는 캐시일 뿐이고 비ISO 시리얼 문자열이 들어온 전례도 있다 — me.ts ISO_DATE 가드 참조.)
  let sheetCourseStart: Date | null = null;
  let beyondSheetPhysicalLimit = false;
  if (!pilotDb && dbEnabled()) {
    sheetCourseStart = await readCourseStart(spreadsheetId); // 아래 시트 폴백이 재사용(추가 read 0)
    beyondSheetPhysicalLimit =
      weekIndexOf(targetDate, sheetCourseStart) > MAX_SHEET_WEEK;
  }

  if (dbEnabled() && (pilotDb || beyondSheetPhysicalLimit)) {
    try {
      // 파일럿은 기존대로 레지스트리 K 캐시 우선(시트 read 0회 목표) — 동작 무변경.
      courseStart = pilotDb
        ? user.courseStartISO
          ? parseISO(user.courseStartISO)
          : await readCourseStart(spreadsheetId)
        : sheetCourseStart!;
      // 비파일럿은 **DB 백필 이력이 없다**(미러는 2026-07-07~, 대상도 파일럿뿐) → 누적합·미팅·
      // 현수막 주문합을 DB 에서 재계산하면 0 으로 보인다. 그 셋은 시트 정본을 그대로 쓴다.
      const [all, allMeetings, orderQty] = await Promise.all([
        readSalesRowsFromDb(spreadsheetId),
        pilotDb ? readMeetingsFromDb(spreadsheetId) : Promise.resolve(null),
        pilotDb ? readBannerOrderQtyFromDb(spreadsheetId) : Promise.resolve(null),
      ]);
      const valid = all.filter((r): r is DailyMetricRow =>
        (CHANNEL_ORDER as readonly string[]).includes(r.channel),
      );
      metricRows = valid;
      if (pilotDb) {
        sums = stackingSumsFromRows(valid);
        meetings = (allMeetings ?? []).filter((m) => m.예약일 === date); // findByDate(reservation) 동치
        bannerOrderQty = orderQty;
      }
      dbCanonicalRead = true;
    } catch (e) {
      Sentry.captureException(e, { tags: { where: "loadDay-db-read" } });
      courseStart = null; // dbCanonicalRead 는 try 마지막 문장 — 여기선 false 유지
      metricRows = null; // ↓ 아래에서 전부 시트 경로로 silent fallback
      sums = null;
      meetings = null;
      bannerOrderQty = null;
    }
  }

  if (metricRows === null) {
    // 기존 시트 경로 (비파일럿 기수 + DB 실패 fallback) — 동작 무변경.
    courseStart = sheetCourseStart ?? (await readCourseStart(spreadsheetId));
    const week0 = weekIndexOf(targetDate, courseStart);
    const inRange0 = week0 >= 1 && week0 <= MAX_SHEET_WEEK;
    const { rows } = inRange0 ? await readWeek(spreadsheetId, week0) : { rows: [] };
    metricRows = rows;
  }

  if (sums === null) {
    // 누적합(생산합·유입합)은 시트 수식이 정본 — 비파일럿 11주+ 도 1~10주 누적은 여기서 정확하다.
    courseStart ??= sheetCourseStart ?? (await readCourseStart(spreadsheetId));
    const stacking = await readChannelStacking(spreadsheetId);
    sums = {
      매입DB생산합: stacking[0]?.[0] ?? 0,
      매입DB유입합: stacking[1]?.[0] ?? 0,
      현수막생산합: stacking[0]?.[2] ?? 0,
    };
  }

  const week = weekIndexOf(targetDate, courseStart!);
  const inRange = dbCanonicalRead || (week >= 1 && week <= MAX_SHEET_WEEK);

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
  const syncDb = syncDbOf(ctx);
  const droppingContract = partial.상태 !== undefined && partial.상태 !== "계약";
  const linkChange = partial.미팅날짜 !== undefined || partial.업체명 !== undefined;
  if (droppingContract || linkChange) {
    const cur = await getMeetingRecord(ctx, id);
    if (cur?.상태 === "계약" && cur.미팅날짜 && cur.업체명) {
      if (droppingContract) {
        await clearContractPaymentByLink(spreadsheetId, cur.미팅날짜, cur.업체명, { syncDb });
      } else {
        const oldKey = { 계약일: cur.미팅날짜, 업체명: cur.업체명 };
        const next = { 계약일: partial.미팅날짜 ?? cur.미팅날짜, 업체명: partial.업체명 ?? cur.업체명 };
        // id 키로 02 행 특정(개명 안전) + 업체명 개명 시 06 키 이동(실패해도 04 저장은 성공).
        // meetingId 를 키로 넘기므로 시트가 새 값으로 바뀐 뒤 재시도해도 같은 행을 찾는다 → 순서 유지.
        await updateContractLink(spreadsheetId, { ...oldKey, meetingId: id }, next, { syncDb });
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
        (m.상태 === "계약" ||
          (await hasCompanyInfoArchiveRow(spreadsheetId, m.미팅날짜, m.업체명, { fromDb: syncDb })))) {
        const ci = { 업체명: m.업체명, 계약일: m.미팅날짜, 업체정보: m.업체정보 };
        await upsertCompanyInfoArchive(spreadsheetId, ci, { syncDb });
      }
    } catch (e) {
      if (syncDb) throw e; // 파일럿: 06 DB 동기 실패는 삼키지 않음(조용한 반쪽쓰기 금지, R3 §0)
      console.warn("[contact] 06 업체정보 동기화 실패:", e instanceof Error ? e.message : e);
    }
  }
}

/** 파일럿(02·06 화면이 DB read) 여부 — 미팅 화면발 계약 쓰기의 dual-sync 게이트(R3-3 잔여). */
export function syncDbOf(ctx: MeetingCtx): boolean {
  return chooseDailySource(ctx.cohort, dbEnabled()) === "db";
}

// 미팅 삭제·되돌리기 cascade — 500줄 캡으로 분리(R3-3 잔여). 공개 API 경로는 유지.
export {
  cascadeDescendantMeetings,
  removeMeeting,
  removeMeetingWithCascade,
  reviveCaseClosure,
  revertMeeting,
} from "./contact-cascade";

/** id로 미팅 조회. */
export async function getMeetingById(
  email: string,
  id: string,
): Promise<Meeting | null> {
  const ctx = await resolveCtx(email);
  return getMeetingRecord(ctx, id);
}
