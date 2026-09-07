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
const sentryUploadEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "salespt",
  project: "javascript-nextjs",
  // 클라이언트 번들 크기 절약
  hideSourceMaps: true,
  disableLogger: true,
  // 인증 토큰 없으면 업로드 스킵 (빌드 실패 방지)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // ★빌드 OOM 방지 (2026-09-07 배포 실패) — 토큰이 없으면 소스맵을 **아예 만들지 않는다**.
  //
  // 무슨 일이 있었나: VPS 빌드가 `--max-old-space-size=2048` 에서 힙을 터뜨렸다
  //   (FATAL: Reached heap limit → JsonStringify). 힙을 4096 으로 올리는 건 이 레포에서
  //   이미 반증된 처방이다 — RAM 3.8GB 라 OOM-killer 가 프로세스를 죽여 BUILD_ID 누락
  //   silent failure 를 냈다(2026-05-13). 그래서 **한도를 올리는 대신 일을 줄인다.**
  //
  // 왜 안전한가: 토큰이 없으면 소스맵은 **업로드되지 않는다**. `hideSourceMaps: true` 라
  // 사용자에게 제공되지도 않는다. 즉 만들어서 버리고 있었다 — 끊어도 **잃는 관측성이 0**이다
  // (Sentry 스택트레이스는 지금도 minified 다, 올라간 맵이 없으니까).
  //
  // 자동 복원: SENTRY_AUTH_TOKEN 을 넣는 순간 다시 생성·업로드된다. 그때는 맵이 실제로
  // 쓰이므로 메모리를 쓸 값어치가 있다. 그 시점에 빌드가 다시 터지면 그때 힙/스왑을 논한다.
  sourcemaps: { disable: !sentryUploadEnabled },
});
