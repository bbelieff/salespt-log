/**
 * Sentry — 브라우저(클라이언트) 런타임 초기화.
 *
 * NEXT_PUBLIC_SENTRY_DSN 이 없으면 자동 비활성 (dev/local 권장).
 * Next.js 15 App Router 표준 패턴 — 빌드 시 자동 inject.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 성능 추적 샘플레이트 — 프로덕션 트래픽 적으면 1.0 유지, 늘면 0.1로 낮추기
    tracesSampleRate: 1.0,
    // 세션 리플레이 비활성 (무료 플랜 한도 보호 — 필요 시 0.1로 활성)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    environment: process.env.NODE_ENV,
    // PII 자동 스크러빙
    sendDefaultPii: false,
  });
}
