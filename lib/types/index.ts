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
  수임비: z.number().int().nonnegative().default(0), // L (원) — v2 단위 통일
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
  meetingReservation: z.number().int().nonnegative().default(0), // H
});
export type ChannelDailyRow = z.infer<typeof ChannelDailyRow>;

// 일별 실적(DailyRevenue, 영업관리!Q~T)은 PR #38·39·40에서 02 계약수납관리로
// 모델 재정의되며 폐기됨. ContractPayment 타입 참조.

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
  cohort: z.string(), // 예: "7" (수강생) / "T" (트레이너) / 빈값(admin)
  name: z.string(),
  spreadsheetId: z.string(), // 트레이너·admin 은 빈 문자열 허용
  role: z.enum(["trainee", "trainer", "admin"]).default("trainee"),
  /** active=정상, pending=트레이너 self-claim 후 관리자 승인 대기 */
  status: z.enum(["active", "pending"]).default("active"),
  /** 수강생 row 의 담당 트레이너 email (관리자가 배정). 빈값 = 미배정. */
  assignedTrainer: z.string().default(""),
  /** 기수 내 팀 (예: "서울", "부산"). 빈값 = 미배정 → 기수 박스 내 개별 카드. */
  team: z.string().default(""),
  /** 시트 B3 캐시 (예: "PRM 7기"). 빈값이면 enrichUsersWithDates 가 fallback 으로
   *  시트 fetch. PR B (2026-05-13) 에서 도입 — registry SSOT 가 시트 SSOT 의
   *  주요 메타를 그림자로 저장해 평시 시트 read 0회 달성. */
  cohortLabel: z.string().default(""),
  /** 시트 C3 캐시 (예: "김상목"). 빈값이면 fallback. */
  nameLabel: z.string().default(""),
  /** 시트 O1 ISO date (YYYY-MM-DD) 캐시. 빈값이면 fallback. */
  courseStartISO: z.string().default(""),
  /** 시트 O2 ISO date (YYYY-MM-DD) 캐시. 빈값이면 fallback. */
  graduationISO: z.string().default(""),
  /** 박스 내 admin 수동 정렬 순서 (M 컬럼). 0 = 미정렬 (이름 알파 fallback, box 하단),
   *  >0 = explicit ASC. dnd-kit 드래그 후 box 내 카드들에 1..N 일괄 재할당.
   *  PR C-1 (2026-05-13). 같은 (cohort, team) 박스 단위로 의미 부여 — 다른 박스 간에는
   *  비교 안 함. */
  sortOrder: z.number().int().nonnegative().default(0),
  /** Drive 부모 폴더 경로/URL (온보딩 입력, registry N). */
  driveParentPath: z.string().default(""),
  /** 01 피드백업체 폴더 ID (자동 탐색 결과, registry O). */
  feedbackFolderId: z.string().default(""),
  /** Drive 연결 상태: "ok" / "" (미연결) / "error" (registry P). */
  driveLinkStatus: z.string().default(""),
  /** 아레나 회장/입금 메모 (registry Q, "회장"/"입금"/"회장,입금"/빈). 전광판 입금자 모수 필터용. */
  memo: z.string().default(""),
  /** 아레나 회장이 맡은 cohort (registry R, 기 제거형 예 "A1-1"). 빈값=일반 참가자.
   *  role 은 trainee 유지(회장도 플레이어). 값 있으면 "기수임원" 조회 권한 (§6). */
  captainOf: z.string().default(""),
});
export type User = z.infer<typeof User>;

// ── 계약수납 v2 (PR 11 contract-payment-tab) ───────────────────
// 시트 매핑: docs/domains/sheet-structure.md §4 v2 — 02 계약수납관리 A~AD
// 자동 연동: 일정·계약 탭 계약 액션 시 04 업체관리!D/G/L에서 C/D/E
// 사용자 입력: F~L (체크박스 7, "ㅇ"/"" 표기) + M~AD (분할수납 3슬롯 × 6필드)

/** 진행률 dropdown — 시트 N/T/Z 컬럼 data validation과 정확히 일치. */
export const Progress = z.enum([
  "",
  "0%",
  "20%",
  "40%",
  "60%",
  "80%",
  "100%",
]);
export type Progress = z.infer<typeof Progress>;

/** 분할 수납 1 슬롯 (v3, 2026-05-17): 메모 추가 — 총 7필드.
 *  시트 매핑 (수정):
 *    수납1 = M~R + AF (메모)
 *    수납2 = S~X + AG (메모)
 *    수납3 = Y~AD + AH (메모)
 *  - 메모는 슬롯별 별도 컬럼 — 기존 슬롯 stride 깨지지 않게 분리.
 */
export const PaymentSlot = z.object({
  진행기관: z.string().default(""),
  진행률: Progress.default(""),
  현황: z.string().default(""), // UI 라벨: '진행내용' (2026-05-17)
  승인금액: z.number().nonnegative().default(0),
  수납액: z.number().nonnegative().default(0),
  수납일: z.string().default(""), // YYYY-MM-DD 또는 빈 문자열
  /** 슬롯별 메모 — 진행기관 다음 위치 표시 (2026-05-17). 시트 AF/AG/AH. */
  메모: z.string().default(""),
});
export type PaymentSlot = z.infer<typeof PaymentSlot>;

const EMPTY_SLOT: PaymentSlot = {
  진행기관: "",
  진행률: "",
  현황: "",
  승인금액: 0,
  수납액: 0,
  수납일: "",
  메모: "",
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
  // 3 분할 수납 (각 슬롯 메모 포함)
  수납1: PaymentSlot.default(EMPTY_SLOT),
  수납2: PaymentSlot.default(EMPTY_SLOT),
  수납3: PaymentSlot.default(EMPTY_SLOT),
  /** 로드맵 메모 (카드 차원, 슬롯들 위) — 시트 AE. 2026-05-17 재배치. */
  로드맵메모: z.string().default(""),
  // 2026-05-17: 카드 차원 메모사항 제거 — 슬롯별 PaymentSlot.메모 로 이동 (AF/AG/AH).
});
export type ContractPayment = z.infer<typeof ContractPayment>;

// ── 실무투두 (05 실무투두 1행 = 1투두) — Scope 2, ADR-0006 ──────
// 시트 매핑: docs/domains/sheet-structure.md §5-2 (A~M 13컬럼)
//   A=id, B=contractRef, C=institutionRef, D=업체명, E=type, F=제목,
//   G=예정일자, H=예정시각, I=장소, J=상세, K=showOnCalendar,
//   L=완료여부, M=생성시각
// (계약 × 기관) 단위. 04 미팅·02 수납과 격리(미팅 집계 수식 영향 0).
// 수식 컬럼 없음 → split-write 불필요.
export const TodoType = z.enum(["기타", "미팅", "전화", "메시지"]);
export type TodoType = z.infer<typeof TodoType>;

export const Todo = z.object({
  id: z.string(),
  contractRef: z.string(), // "계약일|업체명" — 02 계약 안정키 (행번호 아님)
  institutionRef: z.string().default(""), // 슬롯 진행기관 (Scope 3 조인 키)
  업체명: z.string().default(""),
  type: TodoType.default("기타"),
  제목: z.string().min(1, "제목 필수"),
  예정일자: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  예정시각: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "HH:MM")
    .or(z.literal(""))
    .default(""), // 빈 허용
  장소: z.string().default(""),
  상세: z.string().default(""),
  showOnCalendar: z.boolean().default(true),
  완료여부: z.boolean().default(false),
  생성시각: z.string().default(""), // ISO
});
export type Todo = z.infer<typeof Todo>;

// ── Dashboard view types (PR 12 dashboard-page) ─────────────────
// SSOT: docs/domains/data-model.md §대시보드 데이터 출처
// 대시보드 탭은 read-only (시트 수식 자동 집계). 코드는 service에서 1회 batchGet 후 매핑.

/** 4 KPI 카드 — 영업이익/이익률/총매출/총비용/누적수임비 */
export interface DashboardKPI {
  영업이익: number; // = 총매출 − 총비용
  영업이익률: number; // (영업이익 / 총매출) × 100
  총매출: number; // 대시보드 D21 (= '01 영업관리'!N6)
  총비용: number; // 대시보드 E21 (좌표 디스커버리 필요)
  누적수임비: number; // TODO: 셀 좌표 디스커버리
  수임비합: number; // 총매출 분해: Σ수임비 (배너 표시)
  수수료합: number; // 총매출 분해: Σ수납액(수수료). 총매출 = 수임비합 + 수수료합
}

/** 채널별 6단계 funnel matrix — stacked bar 데이터 */
export interface DashboardChannelMatrix {
  채널: "매입DB" | "직접생산" | "현수막" | "콜·지·기·소";
  생산: number;
  유입: number;
  컨택진행: number;
  미팅예약: number; // 영업관리 H 채널별 합계
  미팅완료: number; // = 영업관리!L (시트 자동 집계, 상태 IN ["계약","완료"]) — 취소·변경 제외
  계약: number; // 04 업체관리 K=TRUE 채널별 COUNTIFS
}

/** 주차별 추이 — 8주 LineChart (사용자 결정 2026-05-08: 영업이익 → 계약수) */
export interface DashboardWeeklyPoint {
  주차: number; // 1~8
  계약수: number; // 시트 01 영업관리!N{38,72,106,140,174,208,242,276}
  활동량: number; // 시트 대시보드(자동작성) III. 주차별 마지막 컬럼
}

/** 비용 구성 — 3 비용 채널 (콜·지·기·소 제외) PieChart/Donut */
export interface DashboardCostBreakdown {
  채널: "매입DB" | "직접생산" | "현수막";
  비용: number; // 만원
}

/** 대시보드 1회 read 응답 — Recharts/카드에 그대로 매핑 가능. */
export interface DashboardView {
  kpi: DashboardKPI;
  channelMatrix: DashboardChannelMatrix[]; // 길이 4
  weeklyTrend: DashboardWeeklyPoint[]; // 길이 8
  costBreakdown: DashboardCostBreakdown[]; // 길이 3
  /** 콜·지·기·소 수임비 별도 (도넛 외부 표시) */
  콜지기소수임비: number;
}
