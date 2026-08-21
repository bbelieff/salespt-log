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
 *   • 누적수임비 (대시보드 B21): 이월 제외 Σ수임비(arena). 정의는 belie 확정(2026-08-05, BBE-66,
 *       "이월 제외 + 전체 계약 수임비 합산") — 이 구현과 일치. ⚠️ 단, 파일럿 전원 diff 0 실증은
 *       미완(shadowCompareDashboard 미호출·reverseShadowCompare 는 2026-08부터 기본 OFF — 성능).
 *       재검증하려면 VPS 에서 `node scripts/ops/dashboard-parity.mjs --cohort "8,9,연습,A1-0,..."`
 *       또는 VPS 환경변수 DASHBOARD_SHADOW_COMPARE=1 로 재점화 후 Sentry `[dashboard-parity-rev]`
 *       경보의 필드명 확인.
 *
 * ⚠️ 활동량의 미팅/생산 정의는 적대적 검증에서 지목돼 실측 규명 완료(2026-07-09).
 * B21 은 정의만 확정 — 실측 diff 0 은 미완(위 참고).
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
import { STATS_WEEKS } from "@/config/cohort-dates";
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
/** 미팅이 성사(미팅완료) — 상태∈{완료,계약}. 활동량·R5 공용. 이월 제외는 호출부에서.
 * BBE-64(profile-stats-db) 도 재사용 — 새로 만들지 말 것. */
export const DONE = (상태: Meeting["상태"]): boolean => 상태 === "완료" || 상태 === "계약";
/** 이월 미팅(구분="이월", 시트 AO열) — 퍼널·활동량 카운트에서 제외.
 * BBE-64(profile-stats-db) 도 재사용 — 새로 만들지 말 것. */
export const CARRYOVER = (mt: Meeting): boolean => mt.구분 === "이월";

/** R1:U6 채널 매트릭스(생산/유입/컨택진행/계약)가 실제로 합산하는 주차 창(1~STATS_WEEKS) 안인가 —
 * R4 무제한 쓰기의 집계 클램프. 날짜가 없거나 파싱 불가면 **제외**(fail-closed) — 창 판정을 못 하는
 * 행이 지표를 부풀리지 않게.
 * ⚠️ BBE-120(2026-08-10) 실측 정정 — 이전 버전은 이 창을 MAX_SHEET_WEEK(10)로 클램프했으나,
 * FORMULA 렌더옵션으로 R1:U6 수식 원문을 직접 읽어보니(연습 계정 + 실제 A2-7기 학생 2곳 모두 동일)
 * 실제 합산 범위는 `=E10+E14+…+E272`(8주×7일=56항, 주차블록 1~**8**만 — E272 는 week8 의 마지막
 * 항이지 week10 이 아니다) 였다. N 주차블록 합(R6 계약)도 동일하게 `=N10+…+N272`(1~8주). MAX_SHEET_WEEK
 * (10)는 시트 물리 상한(쓰기 좌표 계산용, lib/repo/sales.ts)일 뿐 — 이 대시보드 재계산에는 STATS_WEEKS
 * (8)가 맞다. 9~10주차 데이터가 있는 사용자는 이 클램프 없이 재계산하면 DB 재계산이 시트 수식보다
 * 커진다(parity run 31361493846 그룹A 3명 sheet<db 실측과 정확히 일치). */
function inSheetWindow(dateISO: string | undefined, courseStart: Date): boolean {
  if (!dateISO) return false;
  const w = weekIndexOf(parseISO(dateISO), courseStart);
  return Number.isFinite(w) && w >= 1 && w <= STATS_WEEKS;
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
    // R4 W1-1: **시트 표현 가능 창(1~STATS_WEEKS) 클램프**(양방향). 무제한 쓰기(9주+ DB-only)를
    // 열면서 이게 없으면 시트가 담지 못하는 행까지 합산돼 대시보드가 영구히 부푼다. 하한도 건다 —
    // 삭제된 쓰기 가드(isWithinSalesWindow=salesRowFor)는 주차 0(수강 시작 전) 기입도 막고 있었다.
    // 실측 근거(BBE-120, 2026-08-10 재확인): 시트 R1~R3 = `=E10+E14+…+E272`(56항=8주×7일,
    // 주차블록 1~8만 — E272 는 week8 마지막 항) → 창 밖은 시트도 안 센다.
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
    //   R6 계약        = N10+N14+…+N272 — **주차블록 합(1~STATS_WEEKS, BBE-120 재확인)** → 클램프 필요.
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

/** 누적수임비(B21) = 이월 제외 Σ수임비(arena). 정의 belie 확정(2026-08-05, BBE-66).
 * ⚠️ BBE-252 후속(2026-08-20) 실측 — 시트 B21 실제 수식은 `='01 영업관리'!O4`
 * (`O4=O38+O72+...+O276`, 1~8주 stride 8개 셀의 합) 이다. 이 재구현은 "이월 제외
 * 전체합"으로 STATS_WEEKS(8) 창 클램프가 빠져 있었다 — weeklyContractsFromDb/
 * weeklyActivityFromDb 등 이 파일의 다른 3개 집계는 이미 이 클램프를 쓴다(BBE-120).
 * 9주+ 무제한 CRM 기록(ADR-0031)이 있는 사용자는 이 클램프 없이 계산하면 시트보다
 * 부풀려진다(6·7기 실측, 7기 8명 중 6명이 이 클램프만으로 diff 0 — a808ed0d0385:
 * 클램프전 sheet=8300000/db=13300000 diff -5000000 → 클램프후 diff 0). 파일럿 전원
 * diff 0 실증은 미완 — 파일 상단 주석 참고. */
export function arenaFeeFromDb(
  contracts: ContractPayment[],
  courseStart: Date,
  courseStartISO: string,
): number {
  let fee = 0;
  for (const c of contracts) {
    if (isCarryoverContract(c, courseStartISO)) continue;
    // ★이 파일의 inSheetWindow()는 MAX_SHEET_WEEK(10) 클램프 — R1:U6 채널매트릭스 전용
    // (실측 근거 다름, :68-74 주석). B21/O4 는 8개 stride 항(O38..O276)만 합산하므로
    // STATS_WEEKS(8) 직접 비교를 쓴다 — weeklyContractsFromDb/weeklyActivityFromDb 와 동일 패턴.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.계약일 ?? "")) continue;
    const w = weekIndexOf(parseISO(c.계약일!), courseStart);
    if (w < 1 || w > STATS_WEEKS) continue;
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
    누적수임비: arenaFeeFromDb(contracts, courseStart, courseStartISO),
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
