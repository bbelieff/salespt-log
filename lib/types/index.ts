/**
 * Layer: types — 도메인 모델 (Zod).
 * 이 레이어는 다른 레이어를 import 하지 않는다. (구조 테스트가 강제)
 *
 * SSOT:
 *   - docs/domains/data-model.md
 *   - docs/domains/sheet-structure.md
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

// ── 4지표 (컨택관리 탭 — 채널마다 4개) ──────────────────────────
// data-model.md 기준: 영업관리 E=생산 / F=유입 / G=컨택진행 / H=컨택성공
export const MetricKey = z.enum(["production", "inflow", "contactProgress", "contactSuccess"]);
export type MetricKey = z.infer<typeof MetricKey>;

export const METRIC_LABEL: Record<MetricKey, string> = {
  production: "생산",
  inflow: "유입",
  contactProgress: "컨택진행",
  contactSuccess: "컨택성공",
};

// ── 미팅 상태 (5종 — schedule-weekly v2 / calendar v3) ─────────
export const MeetingState = z.enum(["예약", "계약", "완료", "변경", "취소"]);
export type MeetingState = z.infer<typeof MeetingState>;

// ── 미팅 (업체관리 탭 1행 = 1미팅) ──────────────────────────────
// 시트 매핑 (sheet-structure.md §3):
//   A=id, B=예약일, C=예약시각, D=미팅날짜, E=미팅시간, F=채널,
//   G=업체명, H=장소, I=예약비고, J=상태, K=계약여부, L=수임비,
//   M=미팅사유 (`업체명, 이유` 1줄), N=표시상세(수식), O=표시요약(수식),
//   P=계약조건, Q=계약합성라인(수식)
//
// ⚠️ N/O/Q는 시트 수식 자동 — 웹은 쓰지 않음 (이 타입에 미포함).
export const Meeting = z.object({
  id: z.string(),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식"), // B열: 예약 잡은 날
  reservationTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM 형식"), // C열: 예약 기록 시각
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식"), // D열
  meetingTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM 형식 (15분 단위)"), // E열
  channel: Channel, // F열
  vendor: z.string().min(1, "업체명 필수"), // G열
  location: z.string().min(1, "장소 필수"), // H열 — 2026-04-24 시트 사양 검증에서 필수화
  reservationNote: z.string().max(500).optional(), // I열
  state: MeetingState.default("예약"), // J열
  isContract: z.boolean().default(false), // K열 — J="계약"과 동기화 (호환용)
  fee: z.number().int().nonnegative().default(0), // L열, 만원 단위
  // M열: 미팅사유 — `업체명, 이유` 1줄. [완료]/[변경]/[취소] 시 작성, [계약]은 안 적음.
  // 영업관리!M으로 시트 수식 자동 누적.
  meetingReason: z.string().default(""),
  // P열: 계약조건 — 계약 시만 (예: "6개월 분할, 부가세 별도")
  contractTerms: z.string().default(""),
});
export type Meeting = z.infer<typeof Meeting>;

// ── 수납 한 행 (수납관리 탭 1행 = 1입금) ────────────────────────
// 시트 매핑 (sheet-structure.md §4):
//   A=id, B=수납날짜, C=승인건수, D=수납건수, E=수납금액(만원), F=기관·접수내용
export const PaymentRow = z.object({
  id: z.string(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // B열
  approvalCount: z.number().int().nonnegative(), // C열
  paymentCount: z.number().int().nonnegative(), // D열
  paymentAmount: z.number().int().nonnegative(), // E열, 만원
  agencyNote: z.string().max(500).default(""), // F열
});
export type PaymentRow = z.infer<typeof PaymentRow>;

// ── 영업관리 탭 1행 = (날짜, 채널) 4지표 카운트 ─────────────────
// 시트 매핑 (sheet-structure.md §2):
//   A=날짜, B=요일(수식), C=일차(수식), D=채널,
//   E=생산, F=유입, G=컨택진행, H=컨택성공  ← 웹 직접 쓰기
//   I~T = 시트 수식 자동 집계 (절대 쓰기 금지)
export const ChannelDailyRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: Channel,
  production: z.number().int().nonnegative().default(0),
  inflow: z.number().int().nonnegative().default(0),
  contactProgress: z.number().int().nonnegative().default(0),
  contactSuccess: z.number().int().nonnegative().default(0),
});
export type ChannelDailyRow = z.infer<typeof ChannelDailyRow>;

// ── 사용자 — 마스터 레지스트리 ─────────────────────────────────
export const User = z.object({
  email: z.string().email(),
  cohort: z.string(), // 예: "PRM 5기"
  name: z.string(),
  spreadsheetId: z.string(), // 본인 전용 시트 ID
  role: z.enum(["trainee", "trainer", "admin"]).default("trainee"),
});
export type User = z.infer<typeof User>;
