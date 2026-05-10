import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ output: "standalone" 제거됨 — PM2 + `next start` 호환 안 됨
  //    (모든 dynamic route 가 silently 404 반환). 필요 시 standalone 으로 가려면
  //    PM2 ecosystem 의 script 를 ".next/standalone/server.js" 로 변경.
  reactStrictMode: true,
  // Next 15.5+: experimental.typedRoutes 는 typedRoutes 로 이동
  typedRoutes: true,
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
