/**
 * GET /api/whoami — **이 탭이 지금 누구로 동작 중인가**만 알려주는 초경량 엔드포인트.
 *
 * ## 왜 필요한가 (2026-09-01 belie 신고)
 * 대리접속 신원(`salespt_as`)은 **httpOnly 쿠키(path=/)** 라 **브라우저 전체가 공유**한다.
 * 그런데 전환은 `window.open('/dashboard')` 로 **새 탭을 여는 방식**이다(`/api/admin/switch`).
 * 그래서 A 학생 탭을 열어둔 채 B 학생을 열면, **A 탭도 그 순간부터 B 로 동작**한다.
 *
 * 실제로 belie 화면에서 상단은 `A2-8기 김현민`, 목록은 문병규 님 계약이 떴다. 헤더가 안 바뀐
 * 이유는 `useMe` 가 `staleTime 1시간` + `refetchOnMount/Focus/Reconnect: false` 라 캐시가
 * 그대로 남기 때문이고, 계약 목록은 새로 받아와 B 것이 온다. **읽기만 문제가 아니다** —
 * 저장도 같은 쿠키(`getWritableUserEmail`)를 쓰므로 **A 탭에서 저장하면 B 기록에 써진다.**
 *
 * 쿠키는 httpOnly 라 JS 가 못 읽는다. 그래서 탭이 자기 신원을 확인하려면 서버 왕복이 필요한데,
 * `/api/me` 는 개인 시트를 읽어 무겁고 1시간 캐시라 이 용도로 못 쓴다. 이 라우트는
 * **세션+쿠키만 읽고 끝난다** — 시트·DB 접근 0.
 *
 * ★개인정보 최소화: 이메일은 마스킹해서 내보내고, 비교용으로는 **해시**만 쓴다.
 *   탭이 필요한 건 "바뀌었나?"뿐이라 원문이 필요 없다.
 */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getActiveUserEmail, getSessionEmail } from "@/auth/identity";
import { withApiTiming } from "@/lib/analytics/api-timing";

/** 비교 전용 지문 — 원문 이메일을 클라이언트로 내보내지 않기 위해. */
function fingerprint(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16);
}

/** 사람에게 보여줄 최소 표기 — "be***@gmail.com". */
function mask(email: string): string {
  return email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}

async function GET_handler() {
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const active = await getActiveUserEmail();
  return NextResponse.json(
    {
      // 이 탭이 지금 "누구로" 읽고 쓰는지의 지문. 값이 바뀌면 대리접속 대상이 바뀐 것이다.
      activeFingerprint: fingerprint(active),
      activeMasked: mask(active),
      impersonating: active.toLowerCase() !== sessionEmail.toLowerCase(),
    },
    // 캐시 금지 — 이 값이 낡으면 가드가 무의미해진다.
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = withApiTiming("api/whoami:GET", GET_handler);
