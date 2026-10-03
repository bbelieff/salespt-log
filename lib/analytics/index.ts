/**
 * Layer: analytics (클라이언트 전용 유틸 — 레이어 규칙·doc-drift 비대상)
 *
 * PostHog 제품분석 래퍼. 타입 안전한 이벤트 capture + 식별 + 에러 캡처.
 * - 실제 init 은 app/providers.tsx 에서 운영(배포) 환경에서만, `window` `load` 이후로
 *   지연 수행한다(BBE-242 처방2 — 초기 페이지 로딩과 PostHog 하위 스크립트 경쟁 제거).
 * - init 이 아직 안 끝난 시점(지연 대기 중)의 호출은 **버퍼링**됐다가 init 완료 직후
 *   순서대로 flush 된다(`flushPendingAnalytics`, providers.tsx 의 `loaded` 콜백에서 호출) —
 *   지연 로딩으로 인한 이벤트 유실 방지.
 * - init 자체가 아예 일어나지 않는 환경(로컬/개발, 키 없음)에서는 여전히 안전한 no-op
 *   (버퍼가 무한정 쌓이지 않도록 `eligibleForInit()`으로 배포+키 존재 여부를 먼저 확인).
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
  CONTRACT_TERMINATED: "contract_terminated", // 계약해지 (contract-termination)
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

/**
 * init 이 조만간 일어날 예정인지(=providers.tsx 의 init 여부 판정과 **동일 조건**) —
 * 이게 false 면 버퍼링해봐야 영영 flush 되지 않으므로(개발환경 등) 기존처럼 즉시 no-op 한다.
 */
function eligibleForInit(): boolean {
  return (
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "production" &&
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
  );
}

let pending: Array<() => void> = [];

/** init 완료면 즉시 실행, init 대기 중(지연 로딩)이면 큐잉, 아예 init 안 될 환경이면 버림. */
function runOrQueue(fn: () => void): void {
  if (ready()) {
    fn();
    return;
  }
  if (eligibleForInit()) {
    pending.push(fn);
  }
}

/**
 * providers.tsx 의 `posthog.init({ loaded: ... })` 콜백에서 1회 호출 — 지연 대기 중
 * 쌓인 호출을 원래 순서(FIFO) 그대로 flush 한다. `__loaded` 가 이미 true 인 시점에
 * 불리므로 이 안에서 실행되는 posthog.* 호출은 전부 정상 동작한다.
 */
export function flushPendingAnalytics(): void {
  const queued = pending;
  pending = [];
  queued.forEach((fn) => fn());
}

/** 도메인 이벤트 전송. init 전이면 버퍼링(지연 로딩 대비), 개발환경 등이면 no-op. */
export function track(event: EventName, properties?: Props): void {
  runOrQueue(() => posthog.capture(event, properties));
}

/** 로그인 사용자 식별 (이메일 기준 + 비-민감 속성 일부). */
export function identifyUser(
  email: string,
  props: { cohort?: string; name?: string; role?: string },
): void {
  if (!email) return;
  runOrQueue(() => {
    posthog.identify(email, {
      cohort: props.cohort,
      name: props.name,
      role: props.role,
    });
    posthog.capture(EVENTS.USER_IDENTIFIED, {
      cohort: props.cohort,
      role: props.role,
    });
  });
}

/** 로그아웃 시 식별 해제 (다음 사용자와 세션 분리). super property 도 함께 초기화됨. */
export function resetUser(): void {
  runOrQueue(() => posthog.reset());
}

/**
 * 내부(관리자·대리접속) 트래픽 태깅 (ADR-0013).
 * 모든 이벤트에 `is_internal:true` super property 부착 → PostHog 인사이트에서
 * `is_internal=false` 필터로 실제 수강생만 집계. 대리접속 중에도 학생 PII 로 identify
 * 하지 않고 슈퍼프로퍼티로만 태그 (ADR-0009 PII 보호 유지).
 */
export function markInternal(viewerRole = "admin"): void {
  runOrQueue(() => posthog.register({ is_internal: true, viewer_role: viewerRole }));
}

/** 일반 수강생 진입 시 내부 태그 제거 (공용 브라우저에서 이전 관리자 세션 잔재 방지). */
export function clearInternal(): void {
  runOrQueue(() => {
    posthog.unregister("is_internal");
    posthog.unregister("viewer_role");
  });
}

/** 쿼리/뮤테이션 실패를 api_error 이벤트로 기록 (전역 핸들러에서 호출). */
export function trackApiError(
  kind: "query" | "mutation",
  error: unknown,
  extra?: { resource?: string },
): void {
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown");
  runOrQueue(() =>
    posthog.capture(EVENTS.API_ERROR, {
      kind,
      resource: extra?.resource,
      message: message.slice(0, 300),
    }),
  );
}
