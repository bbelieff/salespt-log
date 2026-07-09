/**
 * GET /api/gcal/auth — 구글 캘린더 opt-in OAuth 시작 (ADR-0028).
 * 세션 사용자 본인의 구글 계정에 연결(impersonation 무시 — getSessionEmail).
 * CSRF: 랜덤 state 를 httpOnly 쿠키에 저장 후 동의 화면 state 로 전달(콜백에서 대조).
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionEmail } from "@/auth/identity";
import { gcalConsentUrl } from "@/service/gcal-connect";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const state = randomUUID();
  const res = NextResponse.redirect(gcalConsentUrl(state));
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10분 — OAuth 왕복 여유
  });
  return res;
}
