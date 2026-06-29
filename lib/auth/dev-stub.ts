/**
 * dev 전용 stub 인증 가드 (단일 정의점).
 *
 * `NODE_ENV !== "production"` 이고 `STUB_USER_EMAIL` 이 설정된 경우에만 true.
 * 미들웨어(쿠키 기반)와 server component(identity.ts STUB fallback)가 **같은 조건**을 쓰게 해
 * dev 에서 인증 판정이 어긋나 생기는 / ↔ /dashboard 무한 리다이렉트를 막는다.
 * 프로덕션: `NODE_ENV === "production"` 이라 항상 false → 동작 불변. NextAuth 비의존(순수).
 */
export function isDevStubAuthed(): boolean {
  return process.env.NODE_ENV !== "production" && !!process.env.STUB_USER_EMAIL;
}
