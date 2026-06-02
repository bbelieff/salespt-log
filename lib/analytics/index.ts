/**
 * Layer: analytics (클라이언트 전용 유틸 — 레이어 규칙·doc-drift 비대상)
 *
 * PostHog 제품분석 래퍼. 타입 안전한 이벤트 capture + 식별 + 에러 캡처.
 * - 실제 init 은 app/providers.tsx 에서 운영(배포) 환경에서만 수행.
 * - init 안 된 환경(로컬/개발)에서는 모든 호출이 안전한 no-op.
 * - 속성은 **비-PII만** (카테고리·개수·불리언). 이름·금액·업체명 전송 금지.
 *
 * 참고: docs/plans/active/posthog-analytics.md, docs/decisions/0009-posthog-analytics.md
 */
import posthog from "posthog-js";

/**
 * 세션 리플레이 마스킹 토글 (ADR-0009).
 * false = 전부 녹화(사용자 선택). true 로 바꾸면 모든 텍스트·입력 마스킹.
 * password 입력은 이 값과 무관하게 항상 마스킹.
 */
export const SESSION_MASK_PII = false;

/** 코드 전역에서 쓰는 이벤트 이름 상수 (오타·드리프트 방지). */
export const EVENTS = {
  // 컨택탭 (생산·미팅)
  METRICS_SAVED: "metrics_saved",
  MEETING_BOOKED: "meeting_booked",
  MEETING_UPDATED: "meeting_updated",
  MEETING_REVERTED: "meeting_reverted",
  MEETING_REMOVED: "meeting_removed",
  CASE_REVIVED: "case_revived",
  // 실무/수납
  CONTRACT_PAYMENT_ADDED: "contract_payment_added",
  CONTRACT_FEE_SYNCED: "contract_fee_synced",
  CONTRACT_PAYMENT_UPDATED: "contract_payment_updated",
  CONTRACT_PAYMENT_REMOVED: "contract_payment_removed",
  // DB관리
  DB_ROW_ADDED: "db_row_added",
  DB_ROW_UPDATED: "db_row_updated",
  DB_ROW_REMOVED: "db_row_removed",
  // 실무투두
  TODO_CREATED: "todo_created",
  TODO_UPDATED: "todo_updated",
  TODO_REMOVED: "todo_removed",
  // 식별·에러
  USER_IDENTIFIED: "user_identified",
  API_ERROR: "api_error",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
type Props = Record<string, string | number | boolean | null | undefined>;

/** PostHog 가 실제로 init 됐는지 (운영 환경에서만 true). */
function ready(): boolean {
  return typeof window !== "undefined" && Boolean((posthog as { __loaded?: boolean }).__loaded);
}

/** 도메인 이벤트 전송. init 안 됐으면 no-op. */
export function track(event: EventName, properties?: Props): void {
  if (!ready()) return;
  posthog.capture(event, properties);
}

/** 로그인 사용자 식별 (이메일 기준 + 비-민감 속성 일부). */
export function identifyUser(
  email: string,
  props: { cohort?: string; name?: string; role?: string },
): void {
  if (!ready() || !email) return;
  posthog.identify(email, {
    cohort: props.cohort,
    name: props.name,
    role: props.role,
  });
  posthog.capture(EVENTS.USER_IDENTIFIED, {
    cohort: props.cohort,
    role: props.role,
  });
}

/** 로그아웃 시 식별 해제 (다음 사용자와 세션 분리). */
export function resetUser(): void {
  if (!ready()) return;
  posthog.reset();
}

/** 쿼리/뮤테이션 실패를 api_error 이벤트로 기록 (전역 핸들러에서 호출). */
export function trackApiError(
  kind: "query" | "mutation",
  error: unknown,
  extra?: { resource?: string },
): void {
  if (!ready()) return;
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown");
  posthog.capture(EVENTS.API_ERROR, {
    kind,
    resource: extra?.resource,
    message: message.slice(0, 300),
  });
}
