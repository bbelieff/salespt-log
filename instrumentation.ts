/**
 * Next.js 15 instrumentation hook — 런타임별 Sentry config 분기.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// @sentry/nextjs 8.45 typedef 가 onRequestError 미export → typecheck 차단.
// 런타임 동작에는 영향 없음. 8.50+ 정식 export 시 복원.
