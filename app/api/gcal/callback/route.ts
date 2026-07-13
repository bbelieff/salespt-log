/**
 * GET /api/gcal/callback — 구글 OAuth 콜백. code→refresh token 교환·암호화 저장 후
 * 캘린더 탭으로 복귀(?gcal=connected|denied|error). CSRF: state 쿠키 대조(ADR-0028).
 */
import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl } from "@/config";
import { getSessionEmail } from "@/auth/identity";
import { completeGcalConnect } from "@/service/gcal-connect";
import { captureServerEvent, withApiTiming } from "@/lib/analytics/api-timing";

async function GET_handler(req: NextRequest) {
  const url = new URL(req.url);
  // 복귀는 반드시 공개 origin(appBaseUrl) 기준 — req.url 은 프록시 뒤에서
  // localhost:3000 이라 수강생이 localhost 로 튕김(2026-07-10 실사용 사고).
  const back = new URL("/calendar", appBaseUrl());
  const email = await getSessionEmail();
  if (!email) {
    // 세션 만료 — 로그인으로. (연결 미완료)
    return NextResponse.redirect(new URL("/login", appBaseUrl()));
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error"); // 사용자가 동의 거부 시 "access_denied"
  const cookieState = req.cookies.get("gcal_oauth_state")?.value;

  const fail = (kind: "denied" | "error") => {
    back.searchParams.set("gcal", kind);
    const r = NextResponse.redirect(back);
    r.cookies.delete("gcal_oauth_state");
    return r;
  };
  if (err) return fail("denied");
  if (!code || !state || !cookieState || state !== cookieState) return fail("error");

  try {
    await completeGcalConnect(email, code);
    back.searchParams.set("gcal", "connected");
  } catch (e) {
    // OAuth 연결 실패는 리디렉션(?gcal=error)으로 삼켜져 라우트 상태는 성공(307)로 보임 →
    // durable 채널(PostHog)에 명시 기록해야 무음실패를 관찰할 수 있다. 비-PII: 에러 클래스명만.
    captureServerEvent("gcal_connect_error", {
      stage: "callback",
      error: e instanceof Error ? e.name : "unknown",
    });
    back.searchParams.set("gcal", "error");
  }
  const res = NextResponse.redirect(back);
  res.cookies.delete("gcal_oauth_state");
  return res;
}

export const GET = withApiTiming("api/gcal/callback:GET", GET_handler);
