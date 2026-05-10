/**
 * 인증 어댑터 — NextAuth `auth()` 위에 비동기 헬퍼.
 *
 * Phase 1 (STUB) → Phase 2 (NextAuth) 마이그레이션 완료:
 *   - getCurrentUserEmail()
 *       기존: process.env.STUB_USER_EMAIL 반환 (단일 사용자, 로컬 dev)
 *       현재: NextAuth 세션 쿠키에서 email 추출 (다중 사용자, production)
 *   - STUB_USER_EMAIL 폴백 유지 (로컬 dev / 빌드 시 호출 보호)
 *
 * ⚠️ 시그니처 변경: sync → async. 모든 호출자도 await 로 갱신.
 */
import { auth } from "@/auth";

/**
 * 현재 로그인 사용자의 email 반환.
 *
 * 우선순위:
 *  1. NextAuth 세션 쿠키 (production / authenticated)
 *  2. STUB_USER_EMAIL 환경변수 (dev fallback)
 *
 * 미인증 시 throw — 호출 측이 catch 해서 401 또는 /login redirect.
 */
export async function getCurrentUserEmail(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email;
  if (email) return email;

  const stubEmail = process.env.STUB_USER_EMAIL;
  if (stubEmail) return stubEmail;

  throw new Error("[auth] 로그인이 필요합니다.");
}
