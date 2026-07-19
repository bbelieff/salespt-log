/**
 * Layer: types — 채널·지표·랭킹 프리미티브. 다른 레이어 import 안 함(구조 테스트 강제).
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 */
import { z } from "zod";

// ── 채널 (4종 고정 — components.md 규칙) ──────────────────────
export const Channel = z.enum(["매입DB", "직접생산", "현수막", "콜·지·기·소"]);
export type Channel = z.infer<typeof Channel>;

export const CHANNEL_ORDER: readonly Channel[] = [
  "매입DB",
  "직접생산",
  "현수막",
  "콜·지·기·소",
] as const;

// ── 4지표 (컨택관리 — 채널마다 4개) ──────────────────────────
// data-model.md 기준: 01 영업관리 E=생산 / F=유입 / G=컨택진행 / H=미팅 예약건 수
// (구 "컨택성공", 시트 디스커버리 2026-05-08 변경, refactor PR 2026-05-08 코드 정합)
export const MetricKey = z.enum(["production", "inflow", "contactProgress", "meetingReservation"]);
export type MetricKey = z.infer<typeof MetricKey>;

export const METRIC_LABEL: Record<MetricKey, string> = {
  production: "생산",
  inflow: "유입",
  contactProgress: "컨택진행",
  meetingReservation: "미팅예약",
};

/** 전광판 개인 랭킹 지표(arena-scoreboard-v2). 미팅·계약=8주 합, 매출=대시보드 총매출,
 *  앱사용량=5지표(생산+유입+컨택+미팅+계약) 8주 합 활동량 프록시, 공유왕=share_scores points. */
export const RankingMetric = z.enum(["미팅", "계약", "매출", "앱사용량", "공유왕"]);
export type RankingMetric = z.infer<typeof RankingMetric>;

/** 개인 랭킹 1행 — 이름 공개(아레나 커뮤니티 경쟁). value desc·동점 동순위·이름 asc. */
export interface RankingEntry {
  name: string;
  cohort: string;
  value: number;
  rank: number;
}
