/**
 * Layer: types — 대시보드 view 타입(read-only 매핑용 인터페이스). 다른 레이어 import 안 함.
 * index.ts 배럴에서 재수출(2026-07-19, 500줄 캡 분리). 소비자는 `@/types` 유지.
 * SSOT: data-model.md §대시보드 데이터 출처.
 */
import type { Channel } from "./channel";

// ── Dashboard view types (PR 12 dashboard-page) ─────────────────
// SSOT: docs/domains/data-model.md §대시보드 데이터 출처
// 대시보드 탭은 read-only (시트 수식 자동 집계). 코드는 service에서 1회 batchGet 후 매핑.

/**
 * 서버가 싣는 KPI — 누적수임비 하나(시트 B21 과 같은 규칙, DB 전환 그림자 대조용).
 * 매출·비용·영업이익은 화면이 기간별로 계산한다(lib/util/finance-period, ADR-0034) —
 * 서버 사본은 읽는 화면이 없어 2026-10-19 구조 개선 ③에서 걷어냈다.
 */
export interface DashboardKPI {
  누적수임비: number; // 1~8주 수임비 합(시트 B21 과 같은 규칙)
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
  /** Recent-window calendar range, absent for the course-week series. */
  startISO?: string;
  endISO?: string;
  주차: number; // 1~8
  계약수: number; // 시트 01 영업관리!N{38,72,106,140,174,208,242,276}
  활동량: number; // 시트 대시보드(자동작성) III. 주차별 마지막 컬럼
}

/** 비용 구성 — 3 비용 채널 (콜·지·기·소 제외) PieChart/Donut */
export interface DashboardCostBreakdown {
  채널: "매입DB" | "직접생산" | "현수막";
  비용: number; // 원 (화면이 만원으로 줄여 보인다 — ChannelPerformance fmtMan)
}

/**
 * 계약 행 → 연결 미팅의 채널(2026-10-12 #7, 영업이익 상세 「채널별 남은 돈」).
 * 브라우저는 `/api/contract-payment` 행을 같은 키(`@/util/contract-link` contractChannelKey)로 맞춘다.
 * 금액은 싣지 않는다 — 매출·비용 계산은 화면이 기존 기간 함수로 한다.
 */
export interface DashboardContractChannel {
  /** contractChannelKey — AK 가 있으면 `행|ak:AK`, 없으면 `행|계약일|업체명`. */
  key: string;
  /** 연결 미팅의 채널. null = 미팅 없음(`manual:` 영업기록 없이 추가·AK 빈 값·못 찾은 미팅). */
  channel: Channel | null;
}

/** 대시보드 1회 read 응답 — Recharts/카드에 그대로 매핑 가능. */
export interface DashboardView {
  kpi: DashboardKPI;
  channelMatrix: DashboardChannelMatrix[]; // 길이 4
  weeklyTrend: DashboardWeeklyPoint[]; // 길이 8
  weeklyTrendPeriod?: {
    kind: "recent";
    startISO: string;
    endISO: string;
    status: "available" | "unavailable";
  };
  costBreakdown: DashboardCostBreakdown[]; // 길이 3
  /** 콜·지·기·소 수임비 별도 (도넛 외부 표시) */
  콜지기소수임비: number;
  /** 계약 행별 채널(영업이익 상세 채널 표). 배포 직후 캐시된 옛 응답엔 없다 → 표를 그리지 않는다. */
  contractChannels?: DashboardContractChannel[];
}

