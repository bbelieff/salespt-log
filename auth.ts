/**
 * NextAuth 5 root config — Google provider + 1년 슬라이드 세션.
 *
 * 사용자 결정 (docs/plans/active/login-prototype.md):
 *   - 영구 로그인: maxAge 1년 + updateAge 1일 (sliding window)
 *   - JWT strategy (DB 의존 없음)
 *   - 명시적 로그아웃 액션만 세션 종료
 *
 * Scope 정책 (2026-05-12, drive scope 제거):
 *   - basic only: `openid email profile` — Google 신원 확인만.
 *   - drive scope 제거 이유:
 *     - 시트는 admin 의 Drive 에 있고 사용자(수강생) Drive 와 무관.
 *     - 시트 접근은 server-side service account 가 처리 — 사용자 토큰 불필요.
 *     - drive 는 sensitive scope 라 Testing 모드에서 외부 사용자 차단됨 → 사용성 ↓.
 *     - 시트 공유는 운영자가 SA email 을 Drive 폴더에 한 번 공유 (편집자) →
 *       그 폴더 안 모든 시트 자동 권한 상속 — 코드 자동화 불필요.
 *
 * 사용:
 *   - app/api/auth/[...nextauth]/route.ts  → handlers export
 *   - 모든 service/api  → import { auth } from "@/auth"
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ONE_DAY = 60 * 60 * 24;
const ONE_YEAR = ONE_DAY * 365;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // 동의 화면 매번 생략 (이미 승인된 사용자) — 계정 선택만.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: ONE_YEAR,
    updateAge: ONE_DAY,
  },
  jwt: { maxAge: ONE_YEAR },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    /** JWT 콜백 — 세션 토큰에 email 보존. */
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    /** Session 콜백 — 클라이언트가 useSession() 으로 받을 페이로드. */
    async session({ session, token }) {
      if (token.email) session.user = { ...session.user, email: token.email as string };
      return session;
    },
  },
});
