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

/** R2 파일럿 기수 — backfill(#487·#488) 완료 + 9기(첫날부터 dual-write). */
const DB_READ_COHORTS = new Set(["8", "9", "연습"]);

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
