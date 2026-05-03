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

// ── DB관리 — 4채널 raw log (PR 09 db-management) ────────────────
// 시트 매핑: docs/domains/sheet-structure.md §5
// 앱은 raw 입력만 (수식 컬럼은 안 씀).
// 공통 메타: row(1-based 시트 행 번호) — UI에서 update/clear 식별자

export const DBPurchase = z.object({
  row: z.number().int().min(2).optional(),
  구매일: z.string().default(""),
  업체명: z.string().default(""),
  개당단가: z.number().nonnegative().default(0),
  주문개수: z.number().int().nonnegative().default(0),
  주문금액: z.number().nonnegative().optional(), // E열 수식 — 읽기만
  기타: z.string().default(""),
});
export type DBPurchase = z.infer<typeof DBPurchase>;

export const DBProduction = z.object({
  row: z.number().int().min(2).optional(),
  날짜: z.string().default(""),
  소재: z.string().default(""),
  기간예산: z.number().nonnegative().default(0),
  생산개수: z.number().int().nonnegative().default(0),
  개당단가: z.number().nonnegative().optional(), // N열 수식 (예산÷개수)
  기타: z.string().default(""),
});
export type DBProduction = z.infer<typeof DBProduction>;

export const DBBanner = z.object({
  row: z.number().int().min(2).optional(),
  날짜: z.string().default(""),
  업체명: z.string().default(""),
  도착일: z.string().default(""),
  개당단가: z.number().nonnegative().default(0),
  주문개수: z.number().int().nonnegative().default(0),
  주문금액: z.number().nonnegative().optional(),
  기타: z.string().default(""),
});
export type DBBanner = z.infer<typeof DBBanner>;

export const DBLead = z.object({
  row: z.number().int().min(2).optional(),
  구분: z.string().default(""), // 콜드콜/지인/기고객/소개 (자유입력)
  접수일: z.string().default(""),
  대표자명: z.string().default(""),
  업체명: z.string().default(""),
  소개처: z.string().default(""),
  연락처: z.string().default(""),
  조건: z.string().default(""),
});
export type DBLead = z.infer<typeof DBLead>;

// ── 사용자 — 마스터 레지스트리 ─────────────────────────────────
export const User = z.object({
  email: z.string().email(),
  cohort: z.string(), // 예: "PRM 5기"
  name: z.string(),
  spreadsheetId: z.string(), // 본인 전용 시트 ID
  role: z.enum(["trainee", "trainer", "admin"]).default("trainee"),
});
export type User = z.infer<typeof User>;

// ── 계약수납 (PR 11 contract-payment-tab) ──────────────────────
// 시트 매핑: docs/domains/sheet-structure.md §4 — 02 계약수납관리 A~AA
// 자동 연동: 일정·계약 탭 계약 액션 시 04 업체관리에서 C/D/E 가져옴
// 사용자 입력: F~L (체크박스 7) + M~AA (분할수납 3슬롯 × 5필드)

/** 분할 수납 1 슬롯 (진행기관/현황/승인금액/수납액/수납일). */
export const PaymentSlot = z.object({
  진행기관: z.string().default(""),
  현황: z.string().default(""),
  승인금액: z.number().nonnegative().default(0),
  수납액: z.number().nonnegative().default(0),
  수납일: z.string().default(""), // YYYY-MM-DD 또는 빈 문자열
});
export type PaymentSlot = z.infer<typeof PaymentSlot>;

const EMPTY_SLOT: PaymentSlot = {
  진행기관: "",
  현황: "",
  승인금액: 0,
  수납액: 0,
  수납일: "",
};

/** 1 계약 row. row=시트 행번호, 자동연동 3필드 + 체크박스 7 + 수납슬롯 3. */
export const ContractPayment = z.object({
  row: z.number().int().min(3).optional(), // 시트 row (3행~)
  // 자동 연동 (04 업체관리에서)
  계약일: z.string().default(""),
  업체명: z.string().default(""),
  수임비: z.number().nonnegative().default(0),
  // 7 체크박스 (서류 6 + 플러그 이관 1)
  공동인증서: z.boolean().default(false),
  임대차계약서: z.boolean().default(false),
  신분증: z.boolean().default(false),
  드라이브업로드: z.boolean().default(false),
  사업계획서초안발송: z.boolean().default(false),
  컨설팅5종서류발송: z.boolean().default(false),
  플러그이관: z.boolean().default(false),
  // 3 분할 수납
  수납1: PaymentSlot.default(EMPTY_SLOT),
  수납2: PaymentSlot.default(EMPTY_SLOT),
  수납3: PaymentSlot.default(EMPTY_SLOT),
});
export type ContractPayment = z.infer<typeof ContractPayment>;
