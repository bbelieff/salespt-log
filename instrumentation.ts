/**
 * Next.js 15 instrumentation hook — 런타임별 Sentry config 분기.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // 캐시 워밍 — 배포(pm2 reload)마다 in-memory 캐시가 비어 "그 순간 들어온 사람"이
    // 40초를 맞는 문제(2026-08-30 belie 실측)를 없앤다. 서버가 사람보다 먼저 데운다.
    // 기동을 막지 않도록 fire-and-forget, 조건 판정은 startCacheWarmLoop 내부에서.
    const { startCacheWarmLoop } = await import("./lib/service/cache-warm");
    startCacheWarmLoop();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// @sentry/nextjs 8.45 typedef 가 onRequestError 미export → typecheck 차단.
// 런타임 동작에는 영향 없음. 8.50+ 정식 export 시 복원.
