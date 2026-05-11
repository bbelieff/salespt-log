/**
 * NextAuth 5 middleware — (app) 그룹 페이지 보호.
 *
 * 미인증 사용자가 /dashboard /contact /schedule /calendar /payment /db 접근 시
 * → / 로 redirect (LoginScene 표시).
 *
 * /api/* 는 미들웨어에서 제외 — 각 라우트가 자체 401 처리.
 */
import { auth } from "@/auth";
import { NextResponse } from "next/server";

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
  if (isProtected && !req.auth) {
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
