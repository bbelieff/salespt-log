/**
 * GET /api/health — 배포 후 필수 서버 env 존재 검증 (env 손상 재발 방지).
 *
 * 2026-06-15~16 반복 사고: VPS env 줄 붙음/누락으로 AUTH_*·ADMIN_EMAILS 가 깨져
 * 로그인 전면 다운(auth-config-down) / 관리자 강등. 빌드·배포는 success 였음
 * (홈 `/` 는 200이라 겉보기 정상). → 핵심 env 가 비면 **503** 을 반환해 deploy.yml
 * health 단계가 배포를 실패시키도록(빨갛게) 한다. 값은 노출 안 함(boolean 만).
 */
import { NextResponse } from "next/server";
import { adminEmails } from "@/config";
import { getWarmStatus, startCacheWarmLoop } from "@/service/cache-warm";

export const dynamic = "force-dynamic";

export function GET() {
  // 캐시 워밍 루프 자가 기동(멱등) — instrumentation 훅이 안 도는 경우의 보험.
  // 배포 게이트(§6.8)가 기동 직후 이 경로를 반드시 때리므로, 배포마다 확실히 시작된다.
  startCacheWarmLoop();
  const checks = {
    AUTH_SECRET: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
    AUTH_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: !!process.env.AUTH_GOOGLE_SECRET,
    ADMIN_EMAILS: adminEmails().length > 0,
  };
  const ok = Object.values(checks).every(Boolean);
  // 캐시 워밍 관측 — "돌고 있나"를 밖에서 확인할 유일한 창(2026-08-30, §0 Observability).
  // ⚠️ 이 응답은 공개다. 인원수 등 실데이터는 싣지 않는다(위 docblock 원칙과 동일).
  // 워밍 상태는 **ok 판정에 넣지 않는다** — 배포 health 게이트를 흔들면 안 된다.
  return NextResponse.json({ ok, checks, warm: getWarmStatus() }, { status: ok ? 200 : 503 });
}
