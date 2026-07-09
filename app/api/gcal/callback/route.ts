/**
 * GET /api/gcal/callback — 구글 OAuth 콜백. code→refresh token 교환·암호화 저장 후
 * 캘린더 탭으로 복귀(?gcal=connected|denied|error). CSRF: state 쿠키 대조(ADR-0028).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionEmail } from "@/auth/identity";
import { completeGcalConnect } from "@/service/gcal-connect";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const back = new URL("/calendar", req.url);
  const email = await getSessionEmail();
  if (!email) {
    // 세션 만료 — 로그인으로. (연결 미완료)
    return NextResponse.redirect(new URL("/login", req.url));
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
  } catch {
    back.searchParams.set("gcal", "error");
  }
  const res = NextResponse.redirect(back);
  res.cookies.delete("gcal_oauth_state");
  return res;
}
