/**
 * NextAuth 5 middleware — (app) 그룹 페이지 보호.
 *
 * 미인증 사용자가 /dashboard /contact /schedule /calendar /payment /db 접근 시
 * → / 로 redirect (LoginScene 표시).
 *
 * /api/* 는 미들웨어에서 제외 — 각 라우트가 자체 401 처리.
 *
 * dev stub: 미들웨어는 쿠키(req.auth)로만 판정하는데 server component 는 identity.ts 의
 * STUB_USER_EMAIL fallback 으로도 authed → dev 에서 두 판정이 어긋나면 / ↔ /dashboard 무한
 * 리다이렉트(2026-05-11 ERR_TOO_MANY_REDIRECTS). 그래서 identity.ts 와 **동일 가드**로
 * 미들웨어도 통과시킨다. 프로덕션은 NODE_ENV 가드로 항상 false → 동작 불변.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { isDevStubAuthed } from "@/auth/dev-stub";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/payment") ||
    pathname.startsWith("/db") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/trainer");
  if (isProtected && !req.auth && !isDevStubAuthed()) {
    const url = new URL("/", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|salespt-logo.png).*)",
  ],
};
