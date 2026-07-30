/**
 * Layer: service — R2-7a 대시보드 시트수식 재계산 (db-dashboard-aggregates).
 *
 * 대시보드가 읽던 **시트 수식 결과 셀**을 raw 행(DB 미러)에서 재계산한다. 이 PR(R2-7a)은
 * **그림자 대조 전용** — loadDashboard 응답은 계속 시트값, 여기 계산값은 diff 로깅만.
 * 정확도가 검증(diff 0)되면 R2-7b 가 서빙 전환.
 *
 * 재계산 대상 4종(시트 의미는 lib/types DashboardChannelMatrix/DashboardWeeklyPoint 주석 근거):
 *   • channelMatrix (01!R1:U6): 생산/유입/컨택진행/미팅예약 = salesRows 채널별 합,
 *       미팅완료 = 미팅 상태∈{계약,완료} 채널별 수(=영업관리 L), 계약 = 계약여부(K)=TRUE 채널별 수.
 *   • weeklyContracts (01!N{38..276}): 미팅 상태="계약"(J) 을 미팅날짜 weekIndexOf 1~8 버킷.
 *   • weeklyActivity (대시보드 H33:H40): Σ(생산×1 + 컨택×1.5 + 미팅×2), 주차별(불변식①).
 *   • 누적수임비 (대시보드 B21): 이월 제외 Σ수임비(arena). B21 정의 미확정 — diff 로 확정.
 *
 * ⚠️ 시트 수식 의미가 미검증인 항(활동량의 미팅/생산 정의·B21)은 적대적 검증에서 지목됨 —
 * 그림자 대조가 경험적으로 확정할 대상(R2-7b 게이트).
 *
 * courseStart 는 **readProfileBundle.courseStart**(시트 직렬 파생) 를 쓸 것 — user.courseStartISO
 * →parseISO(로컬자정) 와 섞으면 비-UTC 서버에서 경계일 off-by-one(적대검증 risk).
 */
import {
  CHANNEL_ORDER,
  type Channel,
  type ContractPayment,
  type DashboardChannelMatrix,
  type Meeting,
  isCarryoverContract,
} from "@/types";
import { weekIndexOf } from "@/repo/sales";
import { MAX_SHEET_WEEK, STATS_WEEKS } from "@/config/cohort-dates";
import { dbEnabled, readSalesRowsFromDb, type DbSalesRow } from "@/repo/db/client";
import { readContractsFromDb, readMeetingsFromDb } from "@/repo/db/read-daily";
import { captureServerEvent } from "@/lib/analytics/api-timing";

/** "YYYY-MM-DD" → 로컬 자정 Date (write-path parseISO 와 동일 규칙 — 배치-집계 패리티). */
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const EMPTY_STAGE = (ch: Channel): DashboardChannelMatrix => ({
  채널: ch,
  생산: 0,
  유입: 0,
  컨택진행: 0,
  미팅예약: 0,
  미팅완료: 0,
  계약: 0,
});

// 시트 R1:U6 R4/R5·대시보드 L 수식 실측(2026-07-09): 미팅 퍼널 카운트는 **AO<>"이월" 제외**.
// 이월 미팅(아레나로 넘어간 것)은 본인 기수 퍼널·활동량에서 빠진다(carryover 분리).
/** 미팅이 "살아있는"(변경·취소 아님) 상태 — 누적 퍼널 미팅예약 스테이지. 이월 제외는 호출부에서. */
const ALIVE = (상태: Meeting["상태"]): boolean =>
  상태 === "예약" || 상태 === "완료" || 상태 === "계약";
/** 미팅이 성사(미팅완료) — 상태∈{완료,계약}. 활동량·R5 공용. 이월 제외는 호출부에서. */
const DONE = (상태: Meeting["상태"]): boolean => 상태 === "완료" || 상태 === "계약";
/** 이월 미팅(구분="이월", 시트 AO열) — 퍼널·활동량 카운트에서 제외. */
const CARRYOVER = (mt: Meeting): boolean => mt.구분 === "이월";

/** 시트가 물리적으로 담을 수 있는 주차 창(1~MAX_SHEET_WEEK) 안인가 — R4 무제한 쓰기의 집계 클램프.
 * 날짜가 없거나 파싱 불가면 **제외**(fail-closed) — 창 판정을 못 하는 행이 지표를 부풀리지 않게. */
function inSheetWindow(dateISO: string | undefined, courseStart: Date): boolean {
  if (!dateISO) return false;
  const w = weekIndexOf(parseISO(dateISO), courseStart);
  return Number.isFinite(w) && w >= 1 && w <= MAX_SHEET_WEEK;
}

/** 채널별 6단계 stacking (01!R1:U6 재현). 생산/유입/컨택진행=salesRows 합,
 * 미팅예약/미팅완료/계약=미팅 카드 상태별 카운트(누적 퍼널 — 실측 규명 2026-07-09).
 *   미팅예약 = 상태∈{예약,완료,계약}(변경·취소 제외)  ← Σsales.meetingReservation 아님(stale).
 *   미팅완료 = 상태∈{완료,계약}(영업관리 L) · 계약 = 계약여부 TRUE. */
export function channelStackingFromDb(
  salesRows: DbSalesRow[],
  meetings: Meeting[],
  courseStart: Date,
): DashboardChannelMatrix[] {
  const byCh = new Map<Channel, DashboardChannelMatrix>();
  for (const ch of CHANNEL_ORDER) byCh.set(ch, EMPTY_STAGE(ch));

  for (const r of salesRows) {
    const m = byCh.get(r.channel as Channel);
    if (!m) continue; // 오염 채널 무시(CHANNEL_ORDER 만)
    // R4 W1-1: **시트 표현 가능 창(1~MAX_SHEET_WEEK) 클램프**(양방향). 무제한 쓰기(11주+ DB-only)를
    // 열면서 이게 없으면 시트가 담지 못하는 행까지 합산돼 대시보드가 영구히 부푼다. 하한도 건다 —
    // 삭제된 쓰기 가드(isWithinSalesWindow=salesRowFor)는 주차 0(수강 시작 전) 기입도 막고 있었다.
    // 실측 근거: 시트 R1~R3 = `=E10+E14+…+E272`(주차블록 1~10 행 열거) → 창 밖은 시트도 안 센다.
    if (!inSheetWindow(r.date, courseStart)) continue;
    m.생산 += num(r.production);
    m.유입 += num(r.inflow);
    m.컨택진행 += num(r.contactProgress);
  }
  for (const mt of meetings) {
    const m = byCh.get(mt.channel);
    if (!m) continue;
    if (CARRYOVER(mt)) continue; // R4/R5 수식 AO<>"이월" — 이월 미팅 제외
    // ⚠️ 시트 수식 실측(2026-07-28, 연습 시트 R1:U6)이 **단계별로 다른 창**을 쓴다:
    //   R4 미팅예약 · R5 미팅완료 = COUNTIFS(04!F:F,J:J) — **날짜 무필터** → 클램프 금지.
    //   R6 계약        = N10+N14+…+N272 — **주차블록 합(1~MAX_SHEET_WEEK)** → 클램프 필요.
    // 셋을 같은 규칙으로 묶으면 어느 쪽이든 parity 가 깨진다(reverseShadowCompare 영구 diff).
    if (ALIVE(mt.상태)) m.미팅예약 += 1; // 누적 퍼널: 살아있는 미팅 전부(무필터 = 시트 대칭)
    if (DONE(mt.상태)) m.미팅완료 += 1;
    if (mt.계약여부 && inSheetWindow(mt.미팅날짜, courseStart)) m.계약 += 1; // N 주차블록 합 대칭
  }
  return CHANNEL_ORDER.map((ch) => byCh.get(ch)!);
}

/** 주차별 계약수 (01!N{38..276} 재현) — 미팅 상태="계약"(J) 을 미팅날짜 weekIndexOf 1~8 버킷. */
export function weeklyContractsFromDb(
  meetings: Meeting[],
  courseStart: Date,
): number[] {
  const weeks = new Array(STATS_WEEKS).fill(0);
  for (const m of meetings) {
    if (m.상태 !== "계약") continue; // N 은 J="계약" COUNTIFS (완료·변경·취소 제외)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.미팅날짜)) continue;
    const w = weekIndexOf(parseISO(m.미팅날짜), courseStart);
    if (w >= 1 && w <= STATS_WEEKS) weeks[w - 1] += 1; // 8주 밖(0·9·10) 자연 제외
  }
  return weeks;
}

/** 주차별 활동량 (대시보드 H33:H40 재현) — 불변식① 생산×1 + 컨택×1.5 + 미팅×2.
 *  생산=Σproduction·컨택=ΣcontactProgress(salesRows 주차합), **미팅=미팅완료(상태∈{완료,계약})
 *  by 미팅날짜 주차 카운트**(sales.meetingReservation 아님 — stale, 실측 규명 2026-07-09). */
export function weeklyActivityFromDb(
  salesRows: DbSalesRow[],
  meetings: Meeting[],
  courseStart: Date,
): number[] {
  const weeks = new Array(STATS_WEEKS).fill(0);
  for (const r of salesRows) {
    if (!(CHANNEL_ORDER as readonly string[]).includes(r.channel)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const w = weekIndexOf(parseISO(r.date), courseStart);
    if (w < 1 || w > STATS_WEEKS) continue; // 8주 통계만(유예 9~10·시작 전 제외)
    weeks[w - 1] += num(r.production) * 1 + num(r.contactProgress) * 1.5;
  }
  for (const mt of meetings) {
    if (CARRYOVER(mt) || !DONE(mt.상태)) continue; // 미팅완료(성사)·이월제외 (대시보드 L 수식)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mt.미팅날짜)) continue;
    const w = weekIndexOf(parseISO(mt.미팅날짜), courseStart);
    if (w >= 1 && w <= STATS_WEEKS) weeks[w - 1] += 2; // 미팅 가중치 2
  }
  return weeks;
}

/** 누적수임비(B21) 후보 = 이월 제외 Σ수임비(arena). B21 실의미 미확정 — 그림자 diff 로 확정. */
export function arenaFeeFromDb(
  contracts: ContractPayment[],
  courseStartISO: string,
): number {
  let fee = 0;
  for (const c of contracts) {
    if (isCarryoverContract(c, courseStartISO)) continue;
    fee += num(c.수임비);
  }
  return fee;
}

// ── 그림자 대조 diff ────────────────────────────────────────────
export interface ParityDiff {
  field: string; // "channelMatrix.매입DB.생산" | "weeklyContracts[3]" | "누적수임비" 등
  sheet: number;
  db: number;
}

/** 시트 DashboardView 값들과 DB 재계산값을 per-field 대조. 같은 값은 제외, 불일치만 반환. */
export function diffDashboardAggregates(
  sheet: {
    channelMatrix: DashboardChannelMatrix[];
    weeklyContracts: number[];
    weeklyActivity: number[];
    누적수임비: number;
  },
  db: {
    channelMatrix: DashboardChannelMatrix[];
    weeklyContracts: number[];
    weeklyActivity: number[];
    누적수임비: number;
  },
): ParityDiff[] {
  const out: ParityDiff[] = [];
  const push = (field: string, s: number, d: number) => {
    // 소수 오차 흡수(활동량 ×1.5) — 0.5 미만 차이는 반올림 규약 차이로 간주하지 않고 그대로 노출.
    if (num(s) !== num(d)) out.push({ field, sheet: num(s), db: num(d) });
  };
  const STAGES = ["생산", "유입", "컨택진행", "미팅예약", "미팅완료", "계약"] as const;
  for (const ch of CHANNEL_ORDER) {
    const s = sheet.channelMatrix.find((m) => m.채널 === ch);
    const d = db.channelMatrix.find((m) => m.채널 === ch);
    for (const st of STAGES) push(`channelMatrix.${ch}.${st}`, s?.[st] ?? 0, d?.[st] ?? 0);
  }
  for (let i = 0; i < STATS_WEEKS; i++) push(`weeklyContracts[${i + 1}]`, sheet.weeklyContracts[i] ?? 0, db.weeklyContracts[i] ?? 0);
  for (let i = 0; i < STATS_WEEKS; i++) push(`weeklyActivity[${i + 1}]`, sheet.weeklyActivity[i] ?? 0, db.weeklyActivity[i] ?? 0);
  push("누적수임비", sheet.누적수임비, db.누적수임비);
  return out;
}

/** DB 4종 재계산 묶음 — 시트측 값과 대조 가능한 형태. 순수 입력(테스트·parity 스크립트 공용). */
export function computeDbAggregates(
  salesRows: DbSalesRow[],
  meetings: Meeting[],
  contracts: ContractPayment[],
  courseStart: Date,
  courseStartISO: string,
): {
  channelMatrix: DashboardChannelMatrix[];
  weeklyContracts: number[];
  weeklyActivity: number[];
  누적수임비: number;
} {
  return {
    channelMatrix: channelStackingFromDb(salesRows, meetings, courseStart),
    weeklyContracts: weeklyContractsFromDb(meetings, courseStart),
    weeklyActivity: weeklyActivityFromDb(salesRows, meetings, courseStart),
    누적수임비: arenaFeeFromDb(contracts, courseStartISO),
  };
}

/** 그림자 대조 — DB 재계산 후 시트값과 per-field diff 를 PostHog(dashboard_parity)+콘솔 로깅.
 * **fire-and-forget 전용**: loadDashboard 응답을 절대 지연/차단하지 않는다(비파일럿·실패 무해).
 * R2-7a 는 이 로깅만 — 응답은 시트값 그대로. diff 0 확인 후 R2-7b 서빙 전환. */
export function shadowCompareDashboard(
  spreadsheetId: string,
  courseStart: Date,
  courseStartISO: string,
  sheetSide: {
    channelMatrix: DashboardChannelMatrix[];
    weeklyContracts: number[];
    weeklyActivity: number[];
    누적수임비: number;
  },
): void {
  if (!dbEnabled()) return;
  void (async () => {
    const [salesRows, meetings, contracts] = await Promise.all([
      readSalesRowsFromDb(spreadsheetId),
      readMeetingsFromDb(spreadsheetId),
      readContractsFromDb(spreadsheetId),
    ]);
    const db = computeDbAggregates(salesRows, meetings, contracts, courseStart, courseStartISO);
    const diffs = diffDashboardAggregates(sheetSide, db);
    captureServerEvent("dashboard_parity", { diffCount: diffs.length });
    if (diffs.length === 0) {
      console.log("[dashboard-parity] diff 0 ✅");
    } else {
      console.warn(`[dashboard-parity] diff ${diffs.length}건:`);
      for (const d of diffs) {
        console.warn(`  ${d.field}: sheet=${d.sheet} db=${d.db}`);
        // 필드명은 비-PII(좌표·채널·단계명) — PostHog 개별 이벤트로 추적 가능.
        captureServerEvent("dashboard_parity_diff", { field: d.field, sheet: d.sheet, db: d.db });
      }
    }
  })().catch((e) => {
    const msg = (e instanceof Error ? e.message : "unknown").replace(
      /postgres(ql)?:\/\/\S+/gi,
      "[DATABASE_URL]",
    );
    console.warn(`[dashboard-parity] 대조 실패(무해): ${msg}`);
  });
}
