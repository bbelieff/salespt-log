/**
 * Layer: service — R2 읽기 전환 게이트 + 컨택 daily 순수 변환 (db-read-contact, R2-1).
 *
 * 게이트(단일 판정 지점 — 로드맵 §B2 entitlement 스타일, 분기 흩뿌리기 금지):
 *   DB 읽기 = backfill 완료 기수(8·9·연습)만. 그 외는 기존 시트 경로.
 * 순수 변환: 시트 경로(readWeek rows)와 DB 경로(sheet_rows payload)가 **같은 함수**를
 * 지나게 해 정합을 구조적으로 보장 — tests/service/daily-source.test.ts 가 대조 고정.
 */
import { CHANNEL_ORDER, type Channel } from "@/types";
import { isArenaCohortLabel } from "@/repo/user-priority";

/** R2 파일럿 기수 — backfill(#487·#488) 완료 + 9기(첫날부터 dual-write).
 * 4기(2026-08-20 편입, belie 직접 집행 지시): BBE-252 전환 GO 결정판(전수 1명, parity
 * 대조 클린) 근거. 되돌리는 법 = 이 PR git revert(§6.8 표준). */
const DB_READ_COHORTS = new Set(["8", "9", "연습", "4"]);

/** 단일 게이트 — cohort 정규화("8기"→"8") 후 판정. null/빈값 = false.
 * 아레나(A{시즌}-{기수}) 포함 — R2-1.5(db-pilot-arena): 최대 활성 집단 편입.
 * 라벨은 현재 그대로(A1-N) 판정·적재 — 라벨 통합(A1-N→N)은 R5 범위, 여기서 불변. */
export function isDbReadPilot(cohort: string | null | undefined): boolean {
  const norm = String(cohort ?? "").replace(/기\s*$/, "").trim();
  return DB_READ_COHORTS.has(norm) || isArenaCohortLabel(norm);
}

/** 읽기 소스 결정 — DB 활성(env) && 파일럿 기수일 때만 "db". */
export function chooseDailySource(
  cohort: string | null | undefined,
  dbOn: boolean,
): "db" | "sheet" {
  return dbOn && isDbReadPilot(cohort) ? "db" : "sheet";
}

/** 쓰기 정본 결정 — 읽기 게이트(chooseDailySource)와 **대칭**. R3-1(db-write-flip §2·§4).
 * DB 활성 && 파일럿 기수 → "db"(동기 정본, 시트는 비동기 미러). 그 외 → "sheet"(R2: 시트 정본).
 * 롤백 = 이 게이트 한 곳만 뒤집으면 즉시 R2 복귀. 파일럿 집합은 isDbReadPilot 단일 원천 공유. */
export function chooseWriteSource(
  cohort: string | null | undefined,
  dbOn: boolean,
): "db" | "sheet" {
  return dbOn && isDbReadPilot(cohort) ? "db" : "sheet";
}

/** 두 경로 공통 행 형태 — 시트 ChannelDailyRow 와 DB payload 매핑 결과의 교집합. */
export interface DailyMetricRow {
  date: string;
  channel: Channel;
  production: number;
  inflow: number;
  contactProgress: number;
  meetingReservation: number;
}

export interface DayChannelMetrics {
  production: number;
  inflow: number;
  contactProgress: number;
  meetingReservation: number;
}

/** 한 날짜의 4채널 4지표 — 시트/DB 양 경로가 공유하는 유일한 집계 지점. */
export function dayChannelsFromRows(
  rows: DailyMetricRow[],
  date: string,
): Record<Channel, DayChannelMetrics> {
  const out = {} as Record<Channel, DayChannelMetrics>;
  for (const ch of CHANNEL_ORDER) {
    out[ch] = { production: 0, inflow: 0, contactProgress: 0, meetingReservation: 0 };
  }
  for (const r of rows) {
    if (r.date !== date) continue;
    if (!CHANNEL_ORDER.includes(r.channel)) continue;
    out[r.channel] = {
      production: r.production,
      inflow: r.inflow,
      contactProgress: r.contactProgress,
      meetingReservation: r.meetingReservation,
    };
  }
  return out;
}

/** loadWeekMeetings 의 주간 funnel — 시트 readWeekFunnel(주 블록 28행 E~H 합) 의 DB 재현.
 * dates = 그 주 블록의 7일(ISO). 시트와 동일하게 4지표를 전 채널·전 일자 합산. (R2-3) */
export function weekFunnelFromRows(
  rows: DailyMetricRow[],
  dates: readonly string[],
): { 생산: number; 유입: number; 컨택진행: number; 미팅예약: number } {
  const wanted = new Set(dates);
  let 생산 = 0, 유입 = 0, 컨택진행 = 0, 미팅예약 = 0;
  for (const r of rows) {
    if (!wanted.has(r.date)) continue;
    생산 += r.production;
    유입 += r.inflow;
    컨택진행 += r.contactProgress;
    미팅예약 += r.meetingReservation;
  }
  return { 생산, 유입, 컨택진행, 미팅예약 };
}

/** loadDay 가 쓰는 누적 3값 — 시트 R1:U6 수식(생산·유입 누적) 의 DB 재현.
 * R열 수식 정의와 동일: 채널별 전체 기간 합. */
export function stackingSumsFromRows(rows: DailyMetricRow[]): {
  매입DB생산합: number;
  매입DB유입합: number;
  현수막생산합: number;
} {
  let p매입 = 0, i매입 = 0, p현수막 = 0;
  for (const r of rows) {
    if (r.channel === "매입DB") { p매입 += r.production; i매입 += r.inflow; }
    if (r.channel === "현수막") p현수막 += r.production;
  }
  return { 매입DB생산합: p매입, 매입DB유입합: i매입, 현수막생산합: p현수막 };
}
