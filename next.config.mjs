import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ output: "standalone" 제거됨 — PM2 + `next start` 호환 안 됨
  //    (모든 dynamic route 가 silently 404 반환). 필요 시 standalone 으로 가려면
  //    PM2 ecosystem 의 script 를 ".next/standalone/server.js" 로 변경.
  reactStrictMode: true,
  // Next 15.5+: experimental.typedRoutes 는 typedRoutes 로 이동
  typedRoutes: true,
  // 무중단 배포(zero-downtime): 배포 시 BUILD_DIST_DIR=.next-build 로 옛 .next 를 보존한 채
  // 빌드한 뒤 원자 swap 한다. 런타임(next start)은 BUILD_DIST_DIR unset → 기본 ".next".
  // dev/local/CI 도 unset → ".next" 라 무영향. 참고: docs/plans/active/zero-downtime-deploy.md
  distDir: process.env.BUILD_DIST_DIR || ".next",
};

// Sentry wrapper — DSN 미설정 시에도 무해.
// 소스맵 업로드는 SENTRY_AUTH_TOKEN 있을 때만 (현재 미설정 — 추후 추가 가능)
export default withSentryConfig(nextConfig, {
  silent: true,
  org: "salespt",
  project: "javascript-nextjs",
  // 클라이언트 번들 크기 절약
  hideSourceMaps: true,
  disableLogger: true,
  // 인증 토큰 없으면 업로드 스킵 (빌드 실패 방지)
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
