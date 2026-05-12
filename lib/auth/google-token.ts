/**
 * Layer: auth — 서버 사이드 사용자 OAuth access_token 헬퍼.
 *
 * NextAuth 의 session.accessToken 을 안전하게 추출. drive scope 가 함께 부여된
 * 사용자만 유효한 토큰 보유.
 *
 * 사용처:
 *   - /api/admin/add-trainee-prep — prep row 등록 시 SA 자동 공유.
 *   - /api/admin/bulk-add-trainee-prep — 일괄 자동 공유.
 *   - /api/admin/share-all-sheets — 기존 등록 시트 일괄 마이그레이션.
 */
import { auth } from "@/auth";

/**
 * 현재 세션 사용자의 Google OAuth access_token 반환.
 * scope 부여 안 됐거나 로그인 안 했으면 null.
 *
 * NOTE: scope 변경 후 첫 로그인 또는 재로그인한 사용자만 token 보유.
 * 기존 로그인 세션은 권한 부족 — 사용자에게 재로그인 안내 필요.
 */
export async function getServerAccessToken(): Promise<string | null> {
  const session = await auth();
  if (!session) return null;
  const token = (session as unknown as { accessToken?: string }).accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
}
