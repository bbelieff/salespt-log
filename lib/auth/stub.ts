/**
 * 인증 stub — PR A1 (auth flow)이 머지되기 전까지 사용.
 *
 * 환경변수 STUB_USER_EMAIL을 현재 사용자 email로 가정.
 * PR A1 머지 후 이 파일은 `auth()` (NextAuth)로 1줄 교체.
 */

export function getCurrentUserEmail(): string {
  const email = process.env.STUB_USER_EMAIL;
  if (!email) {
    throw new Error(
      "[auth stub] STUB_USER_EMAIL 환경변수가 비어있습니다. " +
        ".env.local에 마스터 레지스트리에 등록된 사용자 email을 설정하세요. " +
        "예: STUB_USER_EMAIL=test@example.com",
    );
  }
  return email;
}
