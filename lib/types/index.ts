/**
 * Layer: types — 도메인 모델 (Zod).
 * 이 레이어는 다른 레이어를 import 하지 않는다. (구조 테스트가 강제)
 *
 * 출처:
 *   - docs/domains/data-model.md  (Meeting 5상태, Channel 4종, Metric 4종)
 *   - docs/domains/sheet-structure.md (영업관리/업체관리/수납관리/대시보드)
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
// 시트 매핑: A=id, B=createdAt, C=수강생, D=미팅날짜, E=미팅시간,
//          F=channel, G=업체명, H=장소, I=예약비고, J=상태,
//          K=계약여부, L=수임비, M=미팅결과(누적), P=계약합성라인
export const Meeting = z.object({
  id: z.string(),
  createdAt: z.string().optional(), // ISO datetime
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식"),
  meetingTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM 형식 (15분 단위)"),
  channel: Channel,
  vendor: z.string().min(1, "업체명 필수"),
  location: z.string().min(1, "장소 필수"), // 2026-04-24 시트 사양 검증에서 필수화
  reservationNote: z.string().max(500).optional(),
  state: MeetingState.default("예약"),
  isContract: z.boolean().default(false), // K열
  fee: z.number().int().nonnegative().default(0), // L열, 만원 단위
  result: z.string().default(""), // M열 — timestamp + 태그 prepend 누적
});
export type Meeting = z.infer<typeof Meeting>;

// ── 수납 한 행 (수납관리 탭 1행 = 1입금) ────────────────────────
// 시트 매핑: A=수납일, B=수강생, C=업체명, D=수임비, E=비고
export const PaymentRow = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: z.string().min(1),
  fee: z.number().int().nonnegative(), // 만원
  note: z.string().max(500).optional(),
});
export type PaymentRow = z.infer<typeof PaymentRow>;

// ── 채널 × 지표 일일 카운트 (영업관리 E~H) ──────────────────────
// 영업관리 탭은 1행 = (날짜, 채널, 지표) 트리플의 카운트.
// E=수강생, F=날짜, G=채널, H=지표키, I~ = 자동 합산
export const ChannelMetricEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: Channel,
  metric: MetricKey,
  count: z.number().int().nonnegative(),
});
export type ChannelMetricEntry = z.infer<typeof ChannelMetricEntry>;

// ── 사용자 — 마스터 레지스트리 ─────────────────────────────────
export const User = z.object({
  email: z.string().email(),
  cohort: z.string(), // 예: "PRM 5기"
  name: z.string(),
  spreadsheetId: z.string(), // 본인 전용 시트 ID
  role: z.enum(["trainee", "trainer", "admin"]).default("trainee"),
});
export type User = z.infer<typeof User>;
