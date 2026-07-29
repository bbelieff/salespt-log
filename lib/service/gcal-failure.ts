/**
 * Layer: service — 구글 캘린더 **연동 실패 사유 분류**(순수 함수, I/O 없음).
 *
 * 콜백 라우트가 예외를 한 갈래(`?gcal=error`)로 뭉개던 문제(2026-07-28 진단)를 고치며 분리했다.
 * 라우트(next/server 의존)와 떼어 두어야 단위 테스트가 가능하고, 카드의 문구 매핑과
 * 한 곳에서 대조된다.
 */

/**
 * 복귀 쿼리 `?gcal=` 값 — 카드가 사유별 안내 문구로 매핑한다(GcalConnectCard).
 * 새 사유를 추가하면 카드 매핑도 같이 늘린다(누락 시 일반 폴백 문구).
 */
export type GcalFailKind =
  | "denied" // 구글 동의 화면에서 사용자가 취소
  | "expired" // state 쿠키 없음/불일치 — 10분 초과·다른 브라우저·쿠키 차단
  | "unregistered" // registry 에 행이 없어 토큰 저장 불가(승인 전 계정)
  | "noconsent" // refresh_token 미수신 — 권한 재동의 필요
  | "error"; // 그 외 — 서버 로그가 원인을 갖는다

/** 예외 메시지 → 사용자 행동으로 이어지는 사유. 분류 못 하면 "error"(원인은 로그에 남는다). */
export function classifyGcalFailure(message: string): GcalFailKind {
  // lib/repo/users.ts updateUserCell — 레지스트리에 행이 없을 때.
  if (message.includes("registry 에서 찾을 수 없습니다")) return "unregistered";
  // lib/repo/gcal-oauth.ts exchangeCodeForToken — 동의가 끝까지 안 됐을 때.
  if (message.includes("refresh_token 미수신")) return "noconsent";
  return "error";
}

/** 서버 로그용 이메일 마스킹 — 평문 주소를 로그에 남기지 않는다. */
export function maskEmailForLog(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? `${email.slice(0, Math.min(3, at))}***${email.slice(at)}` : "(unknown)";
}
