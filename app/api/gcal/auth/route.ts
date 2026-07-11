/**
 * GET /api/gcal/auth — 구글 캘린더 opt-in OAuth 시작 (ADR-0028).
 * **본인 로그인에서만**(fix/gcal-per-user-identity) — 임퍼스네이션이면 시작 자체를
 * 차단하고 캘린더 탭으로 돌려보냄(마스터 구글 계정이 남의 화면에서 연결되는 경로 차단).
 * CSRF: 랜덤 state 를 httpOnly 쿠키에 저장 후 동의 화면 state 로 전달(콜백에서 대조).
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { appBaseUrl } from "@/config";
import { getActiveUserEmail, getSessionEmail } from "@/auth/identity";
import { gcalActorFrom } from "@/service/gcal-guard";
import { gcalConsentUrl } from "@/service/gcal-connect";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const actor = gcalActorFrom(email, await getActiveUserEmail());
  if (actor.impersonated) {
    // <a href> 진입이라 JSON 대신 리디렉션 — 카드가 ?gcal=selfonly 토스트 표시.
    const back = new URL("/calendar", appBaseUrl());
    back.searchParams.set("gcal", "selfonly");
    return NextResponse.redirect(back);
  }
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
