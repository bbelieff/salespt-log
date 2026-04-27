/**
 * Layer: types — 도메인 모델 (Zod).
 * 이 레이어는 다른 레이어를 import 하지 않는다. (구조 테스트가 강제)
 *
 * SSOT (권위):
 *   - docs/domains/data-model.md (v4)
 *   - docs/domains/sheet-structure.md (v4)
 *
 * 필드명 컨벤션 (data-model.md v4):
 *   - 시스템 필드(id, channel) → 영어
 *   - 시트 도메인 필드(예약일, 미팅날짜, 상태 등) → 한국어 (시트 컬럼명과 1:1)
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
// data-model.md 기준: 01 영업관리 E=생산 / F=유입 / G=컨택진행 / H=컨택성공
export const MetricKey = z.enum(["production", "inflow", "contactProgress", "contactSuccess"]);
export type MetricKey = z.infer<typeof MetricKey>;

export const METRIC_LABEL: Record<MetricKey, string> = {
  production: "생산",
  inflow: "유입",
  contactProgress: "컨택진행",
  contactSuccess: "컨택성공",
};

// ── 미팅 상태 (5종) ─────────────────────────────────────────
export const MeetingState = z.enum(["예약", "계약", "완료", "변경", "취소"]);
export type MeetingState = z.infer<typeof MeetingState>;

// ── 미팅 (04 업체관리(앱자동작성용) 1행 = 1미팅) ────────────────
// 시트 매핑 (sheet-structure.md §3, 19컬럼 A~S):
//   A=id, B=예약일, C=예약시각, D=미팅날짜, E=미팅시간, F=channel,
//   G=업체명, H=장소, I=예약비고, J=상태, K=계약여부, L=수임비,
//   M=미팅사유 (`업체명, 이유` 1줄),
//   N=표시상세(수식), O=표시요약(수식),
//   P=계약조건, Q=계약합성라인(수식),
//   R=previousMeetingId, S=주차(수식)
//
// ⚠️ N/O/Q/S는 시트 수식 자동 — 웹은 쓰지 않음. 읽기만 (optional).
export const Meeting = z.object({
  id: z.string(),
  예약일: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"), // B
  예약시각: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM"), // C
  미팅날짜: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"), // D
  미팅시간: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM (15분 단위)"), // E
  channel: Channel, // F
  업체명: z.string().min(1, "업체명 필수"), // G
  장소: z.string().min(1, "장소 필수"), // H — 2026-04-24 사양에서 필수
  예약비고: z.string().max(500).default(""), // I
  상태: MeetingState.default("예약"), // J
  계약여부: z.boolean().default(false), // K — J="계약"과 동기화 (호환용)
  수임비: z.number().int().nonnegative().default(0), // L (만원)
  미팅사유: z.string().default(""), // M `업체명, 이유` 1줄
  계약조건: z.string().default(""), // P (계약 시만)

  // 시트 수식 자동 (읽기 전용, 옵셔널)
  표시상세: z.string().optional(), // N
  표시요약: z.string().optional(), // O
  계약합성라인: z.string().optional(), // Q

  // 변경 추적 + 주차 (실제 시트의 R·S — v4 SSOT 누락분, repo는 유지)
  previousMeetingId: z.string().optional(), // R
  주차: z.number().int().min(1).max(10).optional(), // S (수식)
});
export type Meeting = z.infer<typeof Meeting>;

// ── 영업관리 1행 = (날짜, 채널) 4지표 카운트 ─────────────────
// 01 영업관리 매주 28행 블록 안의 한 행. 웹은 4지표(E~H)만 직접 쓰기.
// I~P는 시트 수식 자동 집계 (절대 쓰기 금지).
export const ChannelDailyRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: Channel,
  production: z.number().int().nonnegative().default(0), // E
  inflow: z.number().int().nonnegative().default(0), // F
  contactProgress: z.number().int().nonnegative().default(0), // G
  contactSuccess: z.number().int().nonnegative().default(0), // H
});
export type ChannelDailyRow = z.infer<typeof ChannelDailyRow>;

// ── 일별 실적(수납) — 01 영업관리!Q~T에 통합 (data-model.md v4) ─
// 별도 수납관리 탭 없음. 1일 = 1레코드 (4채널 행과 별개로 1일에 한 묶음).
export const DailyRevenue = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  approvalCount: z.number().int().nonnegative().default(0), // Q 승인건수
  paymentCount: z.number().int().nonnegative().default(0), // R 수납건수
  paymentAmount: z.number().int().nonnegative().default(0), // S 수납금액 (만원)
  agencyNote: z.string().default(""), // T 비고(기관·접수내용)
});
export type DailyRevenue = z.infer<typeof DailyRevenue>;

// ── 사용자 — 마스터 레지스트리 ─────────────────────────────────
export const User = z.object({
  email: z.string().email(),
  cohort: z.string(), // 예: "PRM 5기"
  name: z.string(),
  spreadsheetId: z.string(), // 본인 전용 시트 ID
  role: z.enum(["trainee", "trainer", "admin"]).default("trainee"),
});
export type User = z.infer<typeof User>;
