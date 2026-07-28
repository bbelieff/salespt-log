/**
 * GET /api/gcal/callback — 구글 OAuth 콜백. code→refresh token 교환·암호화 저장 후
 * 캘린더 탭으로 복귀(?gcal=<사유>). CSRF: state 쿠키 대조(ADR-0028).
 *
 * **관찰성 (2026-07-28, "연동 실패 원인 특정 불가" 진단 후)**:
 *  - 이전: 실패가 전부 `?gcal=error` 한 갈래로 뭉쳐 사용자는 "연결에 실패했어요"만 보고,
 *    서버엔 에러 **클래스명**만 남아 원인을 알 수 없었다(state 불일치 경로는 기록조차 없음).
 *    라우트는 307 로 끝나 HTTP 상태로도 실패가 안 보이는 무음 실패.
 *  - 지금: 실패를 **사유별로 분류**해 ①서버 로그에 원인 메시지(이메일 마스킹) ②분석 이벤트에
 *    사유 코드 ③사용자에게 다음 행동을 아는 문구로 각각 전달한다.
 *  - 로그 금지: refresh token·access token·OAuth code 원문. (교환 실패 메시지는 code 를 포함하지 않는다)
 */
import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl } from "@/config";
import { getSessionEmail } from "@/auth/identity";
import { completeGcalConnect } from "@/service/gcal-connect";
import { captureServerEvent, withApiTiming } from "@/lib/analytics/api-timing";
import { classifyGcalFailure, maskEmailForLog, type GcalFailKind } from "@/service/gcal-failure";

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

  /** 실패 종료 — 원인을 **반드시** 남긴 뒤 사유를 쿼리로 돌려준다. */
  const fail = (kind: GcalFailKind, detail: string, errorName = "none") => {
    // 서버 로그(pm2) — 원인 메시지 전문. 사후 진단의 1차 근거.
    console.error(`[gcal-callback] 연결 실패 kind=${kind} user=${maskEmailForLog(email)} detail=${detail}`);
    // 분석 이벤트 — 사유별 빈도 관찰(비-PII: 사유 코드 + 에러 클래스명만).
    captureServerEvent("gcal_connect_error", { stage: "callback", kind, error: errorName });
    back.searchParams.set("gcal", kind);
    const r = NextResponse.redirect(back);
    r.cookies.delete("gcal_oauth_state");
    return r;
  };

  if (err) return fail("denied", `google error=${err}`);
  if (!code || !state || !cookieState || state !== cookieState) {
    // 어느 조각이 비었는지까지 남겨야 "쿠키 차단"과 "10분 초과"를 구분할 수 있다.
    return fail(
      "expired",
      `code=${code ? "有" : "無"} state=${state ? "有" : "無"} cookie=${cookieState ? "有" : "無"} match=${state === cookieState}`,
    );
  }

  try {
    await completeGcalConnect(email, code);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return fail(classifyGcalFailure(message), message, e instanceof Error ? e.name : "unknown");
  }
  back.searchParams.set("gcal", "connected");
  const res = NextResponse.redirect(back);
  res.cookies.delete("gcal_oauth_state");
  return res;
}

export const GET = withApiTiming("api/gcal/callback:GET", GET_handler);
