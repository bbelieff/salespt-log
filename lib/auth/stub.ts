/**
 * 인증 어댑터 — 호환 레이어.
 *
 * getCurrentUserEmail() 는 이제 lib/auth/identity.ts 의 getActiveUserEmail() 로 위임.
 * Admin 이 다른 사용자를 impersonate 한 경우 자동으로 그 대상 email 반환.
 */
export { getActiveUserEmail as getCurrentUserEmail } from "./identity";
